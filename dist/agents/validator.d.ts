import { z } from "zod";
import type { PRData, ReviewComment } from "../types.js";
import type { AgentRunResult } from "./types.js";
export declare const ValidationSchema: z.ZodObject<{
    confirmed: z.ZodBoolean;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    confirmed: boolean;
    reason: string;
}, {
    confirmed: boolean;
    reason: string;
}>;
export type Validation = z.infer<typeof ValidationSchema>;
interface ValidatorInput {
    prData: PRData;
    finding: ReviewComment;
}
/** Validates a single finding. Returns { confirmed, reason }. */
export declare function runValidator(input: ValidatorInput): Promise<AgentRunResult<Validation>>;
export {};
//# sourceMappingURL=validator.d.ts.map