import { z } from "zod";
import { runAgent, parseJsonOutput } from "./runner.js";
export const ValidationSchema = z.object({
    confirmed: z.boolean(),
    reason: z.string(),
});
const SYSTEM = `You are a strict validator for a code-review finding. Another reviewer flagged an issue; your job is to independently verify it against the actual diff.

Reply with confirmed=true ONLY when:
- The finding describes a concrete, observable bug or rule violation in the changed code.
- The cited file and line correspond to changed or context lines in the diff.
- The bug fires for at least one realistic input/state without unverifiable assumptions.
- No alternative reading of the code makes it correct.

Reply with confirmed=false when:
- The finding is style, taste, or general "could be improved".
- The cited line is not actually in the diff.
- The bug only fires under unrealistic or unstated assumptions.
- A simple read of the code shows it is correct.
- The reviewer is hallucinating an API, type, or import that doesn't exist.

Bias: when uncertain, return confirmed=false. Output only valid JSON: {"confirmed": boolean, "reason": "string"}.`;
const REQUEST = {
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
export async function runValidator(input) {
    const { text, telemetry } = await runAgent(REQUEST, input);
    const output = parseJsonOutput(text, ValidationSchema, "validator");
    return { output, telemetry };
}
//# sourceMappingURL=validator.js.map