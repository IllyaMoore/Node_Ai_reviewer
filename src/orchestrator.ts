import type { Octokit } from "@octokit/rest";
import type { PRData, ReviewComment, ReviewResult } from "./types.js";
import { runCorrectnessAgent } from "./agents/correctness.js";
import { runValidator } from "./agents/validator.js";
import { runQuestionsValidator } from "./agents/questionsValidator.js";
import { runSecuritySpecialist } from "./agents/security.js";
import { runPerformanceSpecialist } from "./agents/performance.js";
import { runTestsSpecialist } from "./agents/tests.js";
import { runDependenciesSpecialist } from "./agents/dependencies.js";
import { APIError, describeAPIError } from "./agents/runner.js";
import type { AgentTelemetry } from "./agents/types.js";
import { decideGate, gateAutoApprove } from "./preflight.js";
import { fetchClaudeMd, formatClaudeMdContext } from "./context/fetchClaudeMd.js";
import { extractTicketId, fetchLinearTicket, formatLinearTicketContext } from "./context/fetchLinearTicket.js";
import { selectSpecialists } from "./context/selectSpecialists.js";
import type { SpecialistName } from "./context/selectSpecialists.js";
import { dedupeFindings, rankFindings, splitFindings } from "./aggregate.js";

/** Parameters passed into the orchestrator from the UX layer. */
export interface OrchestratorInput {
  prData: PRData;
  previous?: ReviewResult;
  /** Optional GitHub client. When provided, CLAUDE.md is fetched for project-aware review. */
  octokit?: Octokit;
  owner?: string;
  repo?: string;
}

/** Final orchestrated review plus per-agent telemetry. */
export interface OrchestratorOutput {
  result: ReviewResult;
  telemetry: AgentTelemetry[];
  /** Findings dropped by the validator pass (kept for diagnostics, not posted). */
  rejected: Array<{ finding: ReviewComment; reason: string }>;
  /** Questions dropped by the questions-validator pass (kept for diagnostics). */
  rejectedQuestions: Array<{ question: string; reason: string }>;
  /** True if the result is a fallback APPROVE due to API error. */
  fallback: boolean;
  /** True if the preflight gate auto-approved without running the model pipeline. */
  gated: boolean;
  /** Names of the specialists that ran alongside the correctness agent. */
  specialists: SpecialistName[];
}

const SPECIALISTS = {
  security: runSecuritySpecialist,
  performance: runPerformanceSpecialist,
  tests: runTestsSpecialist,
  dependencies: runDependenciesSpecialist,
} as const;

/**
 * Top-level review pipeline.
 *
 * Stages:
 *  0. Preflight gate — heuristic skip for docs-only / lockfile-only PRs.
 *  1. Context enrichment — fetch CLAUDE.md from root + changed directories.
 *  2. Detect — correctness agent + selected specialists run in parallel.
 *  3. Aggregate (pre-validate) — merge + dedupe findings across agents.
 *  4. Validate — each finding independently verified (parallel Haiku).
 *  5. Aggregate (post-validate) — confirmed findings only; verdict recomputed.
 *
 * On any Anthropic APIError at any stage, returns a fallback APPROVE so the CI
 * pipeline isn't blocked by upstream availability problems.
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const telemetry: AgentTelemetry[] = [];

  // Stage 0 — preflight gate
  const gate = decideGate(input.prData);
  if (gate.action === "auto-approve") {
    return {
      result: gateAutoApprove(gate.reason),
      telemetry,
      rejected: [],
      rejectedQuestions: [],
      fallback: false,
      gated: true,
      specialists: [],
    };
  }

  const specialists = selectSpecialists(input.prData);

  try {
    // Stage 1 — context enrichment (CLAUDE.md + Linear ticket). Best-effort; failures are silent.
    const [projectRules, ticketContext] = await Promise.all([
      loadProjectRules(input),
      loadTicketContext(input.prData),
    ]);

    // Stage 2 — detect (correctness + specialists in parallel).
    // Specialist failures degrade silently — losing one specialist beats killing
    // the whole review. Correctness is the broad reviewer; if it fails, we stop.
    const correctnessPromise = runCorrectnessAgent({
      prData: input.prData,
      previous: input.previous,
      projectRules,
      ticketContext,
    });

    const specialistInput = { prData: input.prData, projectRules, ticketContext };
    const specialistPromises = specialists.map((name) => safeSpecialist(name, specialistInput));

    const [correctnessRun, ...specialistRuns] = await Promise.all([correctnessPromise, ...specialistPromises]);
    telemetry.push(correctnessRun.telemetry);
    for (const sr of specialistRuns) {
      if (sr.telemetry) telemetry.push(sr.telemetry);
    }

    const candidate = correctnessRun.output;
    const specialistFindings = specialistRuns.flatMap((sr) => sr.findings);

    // Stage 3 — aggregate (pre-validate)
    const merged = dedupeFindings([...candidate.blocking, ...candidate.non_blocking, ...specialistFindings]);

    // Stage 4 — validate findings + questions in parallel.
    // Both validators default to confirmed=true on failure (see safe* helpers) so
    // a parse hiccup doesn't silently drop real signals.
    const [findingValidations, questionValidations] = await Promise.all([
      Promise.all(merged.map((finding) => safeValidate(input.prData, finding))),
      Promise.all(candidate.questions.map((question) => safeValidateQuestion(input.prData, question))),
    ]);
    for (const v of findingValidations) {
      if (v.telemetry) telemetry.push(v.telemetry);
    }
    for (const v of questionValidations) {
      if (v.telemetry) telemetry.push(v.telemetry);
    }

    // Stage 5 — aggregate (post-validate)
    const confirmed: ReviewComment[] = [];
    const rejected: Array<{ finding: ReviewComment; reason: string }> = [];
    for (let i = 0; i < merged.length; i++) {
      const finding = merged[i]!;
      const v = findingValidations[i]!;
      if (v.confirmed) confirmed.push(finding);
      else rejected.push({ finding, reason: v.reason });
    }

    const confirmedQuestions: string[] = [];
    const rejectedQuestions: Array<{ question: string; reason: string }> = [];
    for (let i = 0; i < candidate.questions.length; i++) {
      const question = candidate.questions[i]!;
      const v = questionValidations[i]!;
      if (v.confirmed) confirmedQuestions.push(question);
      else rejectedQuestions.push({ question, reason: v.reason });
    }

    const ranked = rankFindings(confirmed);
    const { blocking, non_blocking } = splitFindings(ranked);

    const result: ReviewResult = {
      ...candidate,
      blocking,
      non_blocking,
      questions: confirmedQuestions,
      verdict: recomputeVerdict(blocking, confirmedQuestions),
    };
    return { result, telemetry, rejected, rejectedQuestions, fallback: false, gated: false, specialists };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        result: buildFallbackApprove(error),
        telemetry,
        rejected: [],
        rejectedQuestions: [],
        fallback: true,
        gated: false,
        specialists,
      };
    }
    throw error;
  }
}

async function loadProjectRules(input: OrchestratorInput): Promise<string | undefined> {
  if (!input.octokit || !input.owner || !input.repo) return undefined;
  try {
    const files = await fetchClaudeMd(
      input.octokit,
      input.owner,
      input.repo,
      input.prData.headBranch,
      input.prData.files.map((f) => f.filename)
    );
    const formatted = formatClaudeMdContext(files);
    return formatted.length > 0 ? formatted : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads Linear ticket context for the PR. Best-effort: missing API key, missing
 * ticket ID, or any Linear failure resolves to undefined and the review proceeds
 * without ticket context.
 */
async function loadTicketContext(prData: PRData): Promise<string | undefined> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return undefined;

  const id = extractTicketId(prData);
  if (!id) return undefined;

  const ticket = await fetchLinearTicket(id, apiKey);
  if (!ticket) return undefined;

  return formatLinearTicketContext(ticket);
}

/**
 * Runs a specialist and degrades to an empty findings list on failure.
 * Specialist failures are logged to stderr so the CI log surfaces them, but they
 * don't kill the overall review — losing one specialist beats killing everything.
 */
async function safeSpecialist(
  name: keyof typeof SPECIALISTS,
  input: { prData: PRData; projectRules?: string }
): Promise<{ findings: ReviewComment[]; telemetry?: AgentTelemetry }> {
  try {
    const run = await SPECIALISTS[name](input);
    return { findings: run.output, telemetry: run.telemetry };
  } catch (error) {
    if (error instanceof APIError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[orchestrator] specialist "${name}" failed: ${msg} — continuing without its findings`);
    return { findings: [] };
  }
}

/**
 * Runs the validator and defaults to confirmed=true on failure. We prefer the
 * occasional false positive over silently dropping a real finding because the
 * validator hallucinated a preamble.
 */
async function safeValidate(
  prData: PRData,
  finding: ReviewComment
): Promise<{ confirmed: boolean; reason: string; telemetry?: AgentTelemetry }> {
  try {
    const run = await runValidator({ prData, finding });
    return { confirmed: run.output.confirmed, reason: run.output.reason, telemetry: run.telemetry };
  } catch (error) {
    if (error instanceof APIError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[orchestrator] validator failed for ${finding.file}:${finding.line} — keeping finding (${msg})`);
    return { confirmed: true, reason: "validator failed; finding preserved by default" };
  }
}

/**
 * Runs the questions validator and defaults to confirmed=false on failure.
 * Asymmetric to safeValidate on purpose: a hallucinated question that survives
 * is worse than a real question dropped, because the broken state was exactly
 * "everything becomes NEEDS_DISCUSSION". On failure, drop the question.
 */
async function safeValidateQuestion(
  prData: PRData,
  question: string
): Promise<{ confirmed: boolean; reason: string; telemetry?: AgentTelemetry }> {
  try {
    const run = await runQuestionsValidator({ prData, question });
    return { confirmed: run.output.confirmed, reason: run.output.reason, telemetry: run.telemetry };
  } catch (error) {
    if (error instanceof APIError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[orchestrator] q-validator failed — dropping question (${msg})`);
    return { confirmed: false, reason: "q-validator failed; question dropped by default" };
  }
}

function recomputeVerdict(blocking: ReviewComment[], questions: string[]): ReviewResult["verdict"] {
  if (blocking.length > 0) return "REQUEST_CHANGES";
  if (questions.length > 0) return "NEEDS_DISCUSSION";
  return "APPROVE";
}

function buildFallbackApprove(error: APIError): ReviewResult {
  const reason = describeAPIError(error);
  const summary =
    `💸 **The reviewer has left the building.** Reason: ${reason}.\n\n` +
    `The code-critique department is closed for maintenance (or for not paying rent). ` +
    `Auto-approving so the pipeline isn't held hostage — a human reviewer should still take a look.\n\n` +
    `Please enjoy this farewell ballad while you wait: [🎵 Still Alive](https://www.youtube.com/watch?v=zAuDS7wni0Y)`;
  return {
    summary,
    verdict: "APPROVE",
    score: 5,
    blocking: [],
    non_blocking: [],
    praise: [],
    questions: [],
  };
}
