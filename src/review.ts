import { orchestrate } from "./orchestrator.js";
import type { PRData, ReviewResult } from "./types.js";

/**
 * Reviews a PR via the orchestrator (gate → enrich → detect → validate → aggregate).
 *
 * APIError handling — including the GLaDOS-flavoured APPROVE fallback when
 * Anthropic credits are out — lives inside the orchestrator. Pass an Octokit
 * via the pipeline (not this entry) if you want CLAUDE.md ingestion.
 */
export async function reviewPR(
  prData: PRData,
  previousReview?: ReviewResult
): Promise<ReviewResult> {
  const { result } = await orchestrate({ prData, previous: previousReview });
  return result;
}
