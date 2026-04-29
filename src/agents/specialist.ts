import { z } from "zod";
import { ReviewCommentSchema } from "../types.js";
import type { PRData, ReviewComment } from "../types.js";
import { runAgent, parseJsonOutput } from "./runner.js";
import type { AgentRequest, AgentRunResult, ModelTier } from "./types.js";

const MAX_DIFF_LENGTH = 80_000;

export const SpecialistOutputSchema = z.object({
  findings: z.array(ReviewCommentSchema),
});
export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;

const SHARED_RUBRIC = `Apply the project's high-signal rubric strictly:

FLAG only issues that are concrete, reproducible bugs in the changed code, with a real attack path or a wrong-result demonstration. The reviewer should look at every finding and think "yes, that is genuinely broken."

DO NOT FLAG style, naming, formatting, subjective suggestions, pre-existing issues outside the diff, hypothetical inputs, linter-catchable issues, pedantic nits, generic input validation without proven impact, or DoS/rate-limiting concerns without a demonstrated attack.

Reply with ONLY valid JSON in this shape (no markdown fences, no extra text):
{ "findings": [
  { "file": "string", "line": number,
    "severity": "critical | major | minor | nit",
    "category": "security | correctness | performance | maintainability | style | test | types | async | deps",
    "issue": "string",
    "suggestion": "string" }
] }

If you find nothing genuinely broken in your area of focus, return { "findings": [] }.`;

const GLADOS_PERSONA = `Stay in the voice of GLaDOS: dry, deadpan, faintly condescending. Backhanded compliments and Aperture Science references are fine in moderation. Every comment must still be a valid, actionable code review.`;

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_LENGTH) return diff;
  return `${diff.slice(0, MAX_DIFF_LENGTH)}\n\n... [DIFF TRUNCATED — original was ${diff.length.toLocaleString()} characters] ...`;
}

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
export function buildSpecialistRequest(def: SpecialistDefinition): AgentRequest<SpecialistInput> {
  const system = `You are a focused code-review specialist. Your area of focus:

${def.focus}

${GLADOS_PERSONA}

${SHARED_RUBRIC}`;

  return {
    name: def.name,
    model: def.model,
    system,
    user: ({ prData, projectRules }) => {
      const diff = truncateDiff(prData.diff);
      const files = prData.files.map((f) => f.filename).join("\n  ");
      let msg = `Review this PR strictly within your focus area.

**Title:** ${prData.title}
**Description:** ${prData.body ?? "None"}
**Base:** ${prData.baseBranch} **Head:** ${prData.headBranch}
**Files:** ${files}

\`\`\`diff
${diff}
\`\`\``;
      if (projectRules && projectRules.trim().length > 0) {
        msg += `

---
**PROJECT RULES** (from CLAUDE.md):

${projectRules}`;
      }
      return msg;
    },
    ...(def.maxTokens !== undefined ? { maxTokens: def.maxTokens } : {}),
  };
}

/** Runs a specialist and returns its findings. */
export async function runSpecialist(
  request: AgentRequest<SpecialistInput>,
  input: SpecialistInput
): Promise<AgentRunResult<ReviewComment[]>> {
  const { text, telemetry } = await runAgent(request, input);
  const output = parseJsonOutput(text, SpecialistOutputSchema, request.name);
  return { output: output.findings, telemetry };
}
