import type { Octokit } from "@octokit/rest";
import type { PRData, ReviewComment, ReviewResult } from "./types.js";
import type { AgentTelemetry } from "./agents/types.js";
import type { SpecialistName } from "./context/selectSpecialists.js";
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
    rejected: Array<{
        finding: ReviewComment;
        reason: string;
    }>;
    /** True if the result is a fallback APPROVE due to API error. */
    fallback: boolean;
    /** True if the preflight gate auto-approved without running the model pipeline. */
    gated: boolean;
    /** Names of the specialists that ran alongside the correctness agent. */
    specialists: SpecialistName[];
}
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
export declare function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput>;
//# sourceMappingURL=orchestrator.d.ts.map