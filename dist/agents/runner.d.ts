import { APIError } from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import type { AgentRequest, AgentRunResult } from "./types.js";
/**
 * Calls Anthropic for a single agent and returns the raw text response plus telemetry.
 * APIError is propagated unchanged so the orchestrator can decide on a fallback.
 */
export declare function runAgent<I>(req: AgentRequest<I>, input: I): Promise<{
    text: string;
    telemetry: AgentRunResult<unknown>["telemetry"];
}>;
/** Strips optional ```json fences and validates the payload against a Zod schema. */
export declare function parseJsonOutput<T>(rawText: string, schema: ZodType<T>, agentName: string): T;
/** Re-export so callers can detect Anthropic-side errors without importing the SDK directly. */
export { APIError };
/** Pulls a human-readable reason out of an Anthropic APIError. */
export declare function describeAPIError(error: APIError): string;
//# sourceMappingURL=runner.d.ts.map