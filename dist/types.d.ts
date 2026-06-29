import { z } from "zod";
/** Zod schema for a single review comment on a specific file/line */
export declare const ReviewCommentSchema: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    severity: z.ZodEnum<["critical", "major", "minor", "nit"]>;
    category: z.ZodEnum<["security", "correctness", "performance", "maintainability", "style", "test", "types", "async", "deps"]>;
    issue: z.ZodString;
    suggestion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file: string;
    line: number;
    severity: "critical" | "major" | "minor" | "nit";
    category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
    issue: string;
    suggestion: string;
}, {
    file: string;
    line: number;
    severity: "critical" | "major" | "minor" | "nit";
    category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
    issue: string;
    suggestion: string;
}>;
/** Zod schema for the full review result returned by Claude */
export declare const ReviewResultSchema: z.ZodObject<{
    summary: z.ZodString;
    verdict: z.ZodEnum<["APPROVE", "REQUEST_CHANGES", "NEEDS_DISCUSSION"]>;
    score: z.ZodNumber;
    blocking: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        severity: z.ZodEnum<["critical", "major", "minor", "nit"]>;
        category: z.ZodEnum<["security", "correctness", "performance", "maintainability", "style", "test", "types", "async", "deps"]>;
        issue: z.ZodString;
        suggestion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }, {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }>, "many">;
    non_blocking: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        severity: z.ZodEnum<["critical", "major", "minor", "nit"]>;
        category: z.ZodEnum<["security", "correctness", "performance", "maintainability", "style", "test", "types", "async", "deps"]>;
        issue: z.ZodString;
        suggestion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }, {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }>, "many">;
    praise: z.ZodArray<z.ZodString, "many">;
    questions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    summary: string;
    verdict: "APPROVE" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION";
    score: number;
    blocking: {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }[];
    non_blocking: {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }[];
    praise: string[];
    questions: string[];
}, {
    summary: string;
    verdict: "APPROVE" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION";
    score: number;
    blocking: {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }[];
    non_blocking: {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }[];
    praise: string[];
    questions: string[];
}>;
/** A single review comment on a specific file/line */
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
/** The full review result returned by Claude */
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
/** Data fetched from GitHub for a pull request */
export interface PRData {
    title: string;
    body: string | null;
    baseBranch: string;
    headBranch: string;
    diff: string;
    files: Array<{
        filename: string;
        patch: string | undefined;
    }>;
}
/** Error thrown when Claude's response cannot be parsed as valid ReviewResult */
export declare class ReviewParseError extends Error {
    readonly rawText: string;
    constructor(message: string, rawText: string);
}
//# sourceMappingURL=types.d.ts.map