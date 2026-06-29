import type { ReviewComment } from "./types.js";
/** Returns true if a finding should be treated as blocking. */
export declare function isBlocking(c: ReviewComment): boolean;
/**
 * Deduplicates findings across multiple agents. Two findings collide when they
 * target the same file:line:category. The strongest severity wins; the stronger
 * finding's issue/suggestion text is kept.
 */
export declare function dedupeFindings(findings: ReviewComment[]): ReviewComment[];
/** Splits a deduped finding list into blocking + non-blocking buckets. */
export declare function splitFindings(findings: ReviewComment[]): {
    blocking: ReviewComment[];
    non_blocking: ReviewComment[];
};
/**
 * Sorts findings by severity (descending) then file/line. Used to give the most
 * important issues a stable position at the top of the list.
 */
export declare function rankFindings(findings: ReviewComment[]): ReviewComment[];
//# sourceMappingURL=aggregate.d.ts.map