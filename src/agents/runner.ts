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

/**
 * Extracts a JSON payload from a model response and validates it against a Zod schema.
 *
 * Handles three common variants:
 *   1. Pure JSON.
 *   2. JSON wrapped in ```json fences.
 *   3. JSON preceded or followed by free-form prose ("Here's my analysis: { ... }").
 *
 * For (3) we scan for the first `{` or `[` and use a brace/bracket-balanced
 * extractor that respects strings and escapes — picking the substring up to the
 * matching closer.
 */
export function parseJsonOutput<T>(rawText: string, schema: ZodType<T>, agentName: string): T {
  const candidate = extractJson(rawText);
  if (candidate === null) {
    throw new ReviewParseError(`Agent "${agentName}" returned no parseable JSON`, rawText);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new ReviewParseError(`Agent "${agentName}" returned invalid JSON`, rawText);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ReviewParseError(`Agent "${agentName}" schema validation failed: ${result.error.message}`, rawText);
  }
  return result.data;
}

/** Finds the first JSON object or array in text and returns the balanced substring. */
function extractJson(rawText: string): string | null {
  const fenced = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  const text = fenced.length > 0 ? fenced : rawText;

  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start: number;
  let openCh: "{" | "[";
  if (firstObj === -1 && firstArr === -1) return null;
  if (firstObj === -1) {
    start = firstArr;
    openCh = "[";
  } else if (firstArr === -1 || firstObj < firstArr) {
    start = firstObj;
    openCh = "{";
  } else {
    start = firstArr;
    openCh = "[";
  }
  const closeCh: "}" | "]" = openCh === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
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
