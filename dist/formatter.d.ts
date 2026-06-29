import type { ReviewResult } from "./types.js";
import type { InlineReviewComment } from "./github.js";
/**
 * Converts blocking + non-blocking findings into inline review comments.
 * Filename and line are taken straight from the agent output; the caller is
 * responsible for filtering against the diff (see github.ts).
 */
export declare function buildInlineComments(result: ReviewResult): InlineReviewComment[];
/**
 * Top-level review body — short, since per-issue detail lives on inline comments.
 * Used as `body` on the GitHub review object alongside `comments[]`.
 */
export declare function formatTopLevelSummary(result: ReviewResult, opts?: {
    droppedInline?: number;
}): string;
/**
 * Converts a ReviewResult into a formatted markdown comment suitable for posting on GitHub.
 *
 * @param result - The parsed review result from Claude
 * @returns Formatted markdown string
 */
export declare function formatComment(result: ReviewResult): string;
//# sourceMappingURL=formatter.d.ts.map