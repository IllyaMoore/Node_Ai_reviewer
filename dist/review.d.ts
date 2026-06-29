import type { PRData, ReviewResult } from "./types.js";
/**
 * Reviews a PR via the orchestrator (gate → enrich → detect → validate → aggregate).
 *
 * APIError handling — including the GLaDOS-flavoured APPROVE fallback when
 * Anthropic credits are out — lives inside the orchestrator. Pass an Octokit
 * via the pipeline (not this entry) if you want CLAUDE.md ingestion.
 */
export declare function reviewPR(prData: PRData, previousReview?: ReviewResult): Promise<ReviewResult>;
//# sourceMappingURL=review.d.ts.map