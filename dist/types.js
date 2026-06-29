import { z } from "zod";
/** Zod schema for a single review comment on a specific file/line */
export const ReviewCommentSchema = z.object({
    file: z.string(),
    line: z.number().int().positive(),
    severity: z.enum(["critical", "major", "minor", "nit"]),
    category: z.enum([
        "security",
        "correctness",
        "performance",
        "maintainability",
        "style",
        "test",
        "types",
        "async",
        "deps",
    ]),
    issue: z.string(),
    suggestion: z.string(),
});
/** Zod schema for the full review result returned by Claude */
export const ReviewResultSchema = z.object({
    summary: z.string(),
    verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "NEEDS_DISCUSSION"]),
    score: z.number().int().min(1).max(10),
    blocking: z.array(ReviewCommentSchema),
    non_blocking: z.array(ReviewCommentSchema),
    praise: z.array(z.string()),
    questions: z.array(z.string()),
});
/** Error thrown when Claude's response cannot be parsed as valid ReviewResult */
export class ReviewParseError extends Error {
    rawText;
    constructor(message, rawText) {
        super(message);
        this.rawText = rawText;
        this.name = "ReviewParseError";
    }
}
//# sourceMappingURL=types.js.map