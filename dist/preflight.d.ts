import type { PRData, ReviewResult } from "./types.js";
/** Decision returned by the preflight gate. */
export interface GateDecision {
    action: "review" | "auto-approve";
    reason: string;
}
/**
 * Decides whether a PR is worth reviewing. Pure heuristic — no LLM cost.
 * Auto-approves docs-only PRs and lockfile-only bumps. Everything else flows
 * through to the full review pipeline.
 */
export declare function decideGate(prData: PRData): GateDecision;
/**
 * Builds the APPROVE result returned when the gate short-circuits.
 * The summary explains why no model-backed review ran.
 */
export declare function gateAutoApprove(reason: string): ReviewResult;
//# sourceMappingURL=preflight.d.ts.map