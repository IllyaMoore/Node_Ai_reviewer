import { runCorrectnessAgent } from "./agents/correctness.js";
import { runValidator } from "./agents/validator.js";
import { runSecuritySpecialist } from "./agents/security.js";
import { runPerformanceSpecialist } from "./agents/performance.js";
import { runTestsSpecialist } from "./agents/tests.js";
import { runDependenciesSpecialist } from "./agents/dependencies.js";
import { APIError, describeAPIError } from "./agents/runner.js";
import { decideGate, gateAutoApprove } from "./preflight.js";
import { fetchClaudeMd, formatClaudeMdContext } from "./context/fetchClaudeMd.js";
import { selectSpecialists } from "./context/selectSpecialists.js";
import { dedupeFindings, rankFindings, splitFindings } from "./aggregate.js";
const SPECIALISTS = {
    security: runSecuritySpecialist,
    performance: runPerformanceSpecialist,
    tests: runTestsSpecialist,
    dependencies: runDependenciesSpecialist,
};
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
export async function orchestrate(input) {
    const telemetry = [];
    // Stage 0 — preflight gate
    const gate = decideGate(input.prData);
    if (gate.action === "auto-approve") {
        return {
            result: gateAutoApprove(gate.reason),
            telemetry,
            rejected: [],
            fallback: false,
            gated: true,
            specialists: [],
        };
    }
    const specialists = selectSpecialists(input.prData);
    try {
        // Stage 1 — context enrichment (CLAUDE.md). Best-effort; failures are silent.
        const projectRules = await loadProjectRules(input);
        // Stage 2 — detect (correctness + specialists in parallel)
        const correctnessPromise = runCorrectnessAgent({
            prData: input.prData,
            previous: input.previous,
            projectRules,
        });
        const specialistInput = { prData: input.prData, projectRules };
        const specialistPromises = specialists.map((name) => SPECIALISTS[name](specialistInput));
        const [correctnessRun, ...specialistRuns] = await Promise.all([correctnessPromise, ...specialistPromises]);
        telemetry.push(correctnessRun.telemetry);
        for (const sr of specialistRuns)
            telemetry.push(sr.telemetry);
        const candidate = correctnessRun.output;
        const specialistFindings = specialistRuns.flatMap((sr) => sr.output);
        // Stage 3 — aggregate (pre-validate)
        const merged = dedupeFindings([...candidate.blocking, ...candidate.non_blocking, ...specialistFindings]);
        if (merged.length === 0) {
            const result = {
                ...candidate,
                blocking: [],
                non_blocking: [],
                verdict: candidate.questions.length > 0 ? "NEEDS_DISCUSSION" : "APPROVE",
            };
            return { result, telemetry, rejected: [], fallback: false, gated: false, specialists };
        }
        // Stage 4 — validate (parallel)
        const validations = await Promise.all(merged.map((finding) => runValidator({ prData: input.prData, finding })));
        validations.forEach((v) => telemetry.push(v.telemetry));
        // Stage 5 — aggregate (post-validate)
        const confirmed = [];
        const rejected = [];
        for (let i = 0; i < merged.length; i++) {
            const finding = merged[i];
            const v = validations[i].output;
            if (v.confirmed)
                confirmed.push(finding);
            else
                rejected.push({ finding, reason: v.reason });
        }
        const ranked = rankFindings(confirmed);
        const { blocking, non_blocking } = splitFindings(ranked);
        const result = {
            ...candidate,
            blocking,
            non_blocking,
            verdict: recomputeVerdict(blocking, candidate.questions),
        };
        return { result, telemetry, rejected, fallback: false, gated: false, specialists };
    }
    catch (error) {
        if (error instanceof APIError) {
            return {
                result: buildFallbackApprove(error),
                telemetry,
                rejected: [],
                fallback: true,
                gated: false,
                specialists,
            };
        }
        throw error;
    }
}
async function loadProjectRules(input) {
    if (!input.octokit || !input.owner || !input.repo)
        return undefined;
    try {
        const files = await fetchClaudeMd(input.octokit, input.owner, input.repo, input.prData.headBranch, input.prData.files.map((f) => f.filename));
        const formatted = formatClaudeMdContext(files);
        return formatted.length > 0 ? formatted : undefined;
    }
    catch {
        return undefined;
    }
}
function recomputeVerdict(blocking, questions) {
    if (blocking.length > 0)
        return "REQUEST_CHANGES";
    if (questions.length > 0)
        return "NEEDS_DISCUSSION";
    return "APPROVE";
}
function buildFallbackApprove(error) {
    const reason = describeAPIError(error);
    const summary = `💸 **The reviewer has left the building.** Reason: ${reason}.\n\n` +
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
//# sourceMappingURL=orchestrator.js.map