import { z } from "zod";
import type { PRData, ReviewComment } from "../types.js";
import { runAgent, parseJsonOutput } from "./runner.js";
import type { AgentRequest, AgentRunResult } from "./types.js";

export const ValidationSchema = z.object({
  confirmed: z.boolean(),
  reason: z.string(),
});
export type Validation = z.infer<typeof ValidationSchema>;

const SYSTEM = `You are a strict validator for a code-review finding. Another reviewer flagged an issue; your job is to independently verify it against the actual diff and reject anything that violates the project's high-signal rubric.

Reply with confirmed=true ONLY when ALL of the following hold:
- The finding describes a concrete, observable bug or rule violation in the changed code.
- The cited file and line correspond to changed or context lines in the diff.
- The bug fires for at least one realistic input/state with a clearly demonstrable path.
- No alternative reading of the code makes it correct.
- The finding does NOT match any rubric exclusion below.

Reply with confirmed=false when ANY of the following hold (rubric exclusions — these are non-negotiable):
- The finding is style, naming, formatting, or casing — that is the linter's job.
- The finding is subjective ("could be better", "consider X", "more idiomatic", "for clarity").
- The finding is a pre-existing issue that the diff did not introduce.
- The finding depends on hypothetical inputs or state without a clearly demonstrated attack/wrong-result path.
- The finding is anything a TypeScript or ESLint config would catch on the next CI run.
- The finding is a pedantic nit, missing JSDoc, doc gap, or "could add a comment".
- The finding is generic input validation without proven impact.
- The finding is a DoS / rate-limiting / resource-exhaustion / concurrency-limit concern without a demonstrated, realistic attack — e.g. "this Promise.all could hit a rate limit on huge inputs" is exactly the kind of finding to REJECT.
- The cited line is not actually in the diff.
- The reviewer is hallucinating an API, type, import, or function that does not exist.
- A simple read of the code shows it is correct.

If your reasoning starts with "technically real but unlikely", "in theory", "could potentially", "on extreme inputs", or "as a defense in depth" — that is confirmed=false.

Bias: when uncertain, return confirmed=false. False positives are more harmful than missed nits.

Output only valid JSON: {"confirmed": boolean, "reason": "1 short sentence"}.`;

interface ValidatorInput {
  prData: PRData;
  finding: ReviewComment;
}

const REQUEST: AgentRequest<ValidatorInput> = {
  name: "validator",
  model: "haiku",
  system: SYSTEM,
  user: ({ prData, finding }) => {
    const file = prData.files.find((f) => f.filename === finding.file);
    const patch = file?.patch ?? "(file not found in PR — finding likely invalid)";
    return `**Finding to validate**
File: ${finding.file}
Line: ${finding.line}
Severity: ${finding.severity}
Category: ${finding.category}
Issue: ${finding.issue}
Suggested fix: ${finding.suggestion}

**Patch for this file**
\`\`\`diff
${patch}
\`\`\`

Respond with JSON: {"confirmed": boolean, "reason": "1 short sentence"}`;
  },
  maxTokens: 256,
};

/** Validates a single finding. Returns { confirmed, reason }. */
export async function runValidator(input: ValidatorInput): Promise<AgentRunResult<Validation>> {
  const { text, telemetry } = await runAgent(REQUEST, input);
  const output = parseJsonOutput(text, ValidationSchema, "validator");
  return { output, telemetry };
}
