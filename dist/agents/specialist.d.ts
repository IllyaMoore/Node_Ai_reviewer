import { z } from "zod";
import type { PRData, ReviewComment } from "../types.js";
import type { AgentRequest, AgentRunResult, ModelTier } from "./types.js";
export declare const SpecialistOutputSchema: z.ZodObject<{
    findings: z.ZodArray<z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    findings: {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }[];
}, {
    findings: {
        file: string;
        line: number;
        severity: "critical" | "major" | "minor" | "nit";
        category: "security" | "correctness" | "performance" | "maintainability" | "style" | "test" | "types" | "async" | "deps";
        issue: string;
        suggestion: string;
    }[];
}>;
export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;
export interface SpecialistInput {
    prData: PRData;
    projectRules?: string;
}
export interface SpecialistDefinition {
    name: string;
    model: ModelTier;
    /** Focus area description injected into the system prompt. */
    focus: string;
    /** Optional max output tokens (defaults to tier default). */
    maxTokens?: number;
}
/**
 * Builds a system prompt and AgentRequest for a specialist. Each specialist has
 * a different focus area but shares the rubric, persona, and JSON schema.
 */
export declare function buildSpecialistRequest(def: SpecialistDefinition): AgentRequest<SpecialistInput>;
/** Runs a specialist and returns its findings. */
export declare function runSpecialist(request: AgentRequest<SpecialistInput>, input: SpecialistInput): Promise<AgentRunResult<ReviewComment[]>>;
//# sourceMappingURL=specialist.d.ts.map