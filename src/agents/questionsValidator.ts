import { z } from "zod";
import type { PRData } from "../types.js";
import { runAgent, parseJsonOutput } from "./runner.js";
import type { AgentRequest, AgentRunResult } from "./types.js";

export const QuestionValidationSchema = z.object({
  confirmed: z.boolean(),
  reason: z.string(),
});
export type QuestionValidation = z.infer<typeof QuestionValidationSchema>;

const SYSTEM = `You are a strict validator for a code-review *question*. Another reviewer raised a question for the PR author; your job is to decide whether the question describes a genuine, unresolved decision the author must answer, or whether it is reviewer noise that should be dropped.

Reply with confirmed=true ONLY when ALL of the following hold:
- The question describes a concrete architectural or behavioural fork in the diff where two legitimate implementations exist and the choice is non-obvious.
- A reasonable author looking at the question would think "yes, I should answer this before this merges."
- The answer is NOT already visible in the diff, types, comments, tests, or PR description.

Reply with confirmed=false when ANY of the following hold (rubric exclusions — non-negotiable):
- The question is rhetorical or performative ("have you considered…?", "is this intentional?", "are you sure about this?").
- The question is a thinly veiled suggestion ("could you also…?", "what about adding…?", "should we extract this into a helper?").
- The question asks for confirmation of something the code already demonstrates.
- The question is a style or naming preference framed as a question.
- The question is "could you clarify X?" where X is explained in the diff, tests, types, or PR body.
- The question is a defensive "what if user does Y" without a realistic path.
- The question is a generic "did you test this?" / "is there a test for this?" without pointing at a specific gap.
- The question is hedging: asking instead of flagging because the reviewer is not confident enough to flag.

Bias: when uncertain, return confirmed=false. The default state for a PR is "no open questions". Questions are the exception, not the rule.

Output only valid JSON: {"confirmed": boolean, "reason": "1 short sentence"}.`;

const MAX_DIFF_LENGTH = 60_000;

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_LENGTH) return diff;
  return `${diff.slice(0, MAX_DIFF_LENGTH)}\n\n... [DIFF TRUNCATED] ...`;
}

interface QuestionsValidatorInput {
  prData: PRData;
  question: string;
}

const REQUEST: AgentRequest<QuestionsValidatorInput> = {
  name: "q-validator",
  model: "haiku",
  system: SYSTEM,
  user: ({ prData, question }) => {
    return `**Question to validate**
${question}

**PR title:** ${prData.title}
**PR description:** ${prData.body ?? "None"}

**Diff**
\`\`\`diff
${truncateDiff(prData.diff)}
\`\`\`

Respond with JSON: {"confirmed": boolean, "reason": "1 short sentence"}`;
  },
  maxTokens: 256,
};

/** Validates a single reviewer question against the rubric. Returns { confirmed, reason }. */
export async function runQuestionsValidator(
  input: QuestionsValidatorInput
): Promise<AgentRunResult<QuestionValidation>> {
  const { text, telemetry } = await runAgent(REQUEST, input);
  const output = parseJsonOutput(text, QuestionValidationSchema, "q-validator");
  return { output, telemetry };
}
