import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { ReviewParseError } from "../types.js";
import type { AgentRequest, AgentRunResult, ModelTier } from "./types.js";

/** Concrete Anthropic model IDs per tier. Update here when bumping models. */
const MODEL_IDS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-1",
};

/** Default max output tokens per tier — tuned to typical agent output sizes. */
const DEFAULT_MAX_TOKENS: Record<ModelTier, number> = {
  haiku: 1024,
  sonnet: 4096,
  opus: 4096,
};

let cachedClient: Anthropic | undefined;

function client(): Anthropic {
  cachedClient ??= new Anthropic();
  return cachedClient;
}

/**
 * Calls Anthropic for a single agent and returns the raw text response plus telemetry.
 * APIError is propagated unchanged so the orchestrator can decide on a fallback.
 */
export async function runAgent<I>(req: AgentRequest<I>, input: I): Promise<{ text: string; telemetry: AgentRunResult<unknown>["telemetry"] }> {
  const start = Date.now();
  const response = await client().messages.create({
    model: MODEL_IDS[req.model],
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS[req.model],
    system: req.system,
    messages: [{ role: "user", content: req.user(input) }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new ReviewParseError(`Agent "${req.name}" returned no text content`, JSON.stringify(response.content));
  }

  return {
    text: block.text,
    telemetry: {
      name: req.name,
      model: req.model,
      durationMs: Date.now() - start,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    },
  };
}

/** Strips optional ```json fences and validates the payload against a Zod schema. */
export function parseJsonOutput<T>(rawText: string, schema: ZodType<T>, agentName: string): T {
  const trimmed = rawText.trim();
  const stripped = trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new ReviewParseError(`Agent "${agentName}" returned invalid JSON`, rawText);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ReviewParseError(`Agent "${agentName}" schema validation failed: ${result.error.message}`, rawText);
  }
  return result.data;
}

/** Re-export so callers can detect Anthropic-side errors without importing the SDK directly. */
export { APIError };

/** Pulls a human-readable reason out of an Anthropic APIError. */
export function describeAPIError(error: APIError): string {
  const body = (error as { error?: { error?: { message?: string }; message?: string } }).error;
  const message = body?.error?.message ?? body?.message ?? error.message ?? "Anthropic API error";
  if (/credit balance/i.test(message)) return "Anthropic credit balance too low";
  if (error.status === 401) return "Anthropic API authentication failed";
  if (error.status === 429) return "Anthropic API rate limit hit";
  return `Anthropic API error (${error.status ?? "unknown"}): ${message}`;
}
