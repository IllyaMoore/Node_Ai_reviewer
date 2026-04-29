import { buildSpecialistRequest, runSpecialist } from "./specialist.js";
import type { SpecialistInput } from "./specialist.js";
import type { AgentRunResult } from "./types.js";
import type { ReviewComment } from "../types.js";

const REQUEST = buildSpecialistRequest({
  name: "security",
  model: "sonnet",
  focus: `Application security in Node.js/TypeScript. Look ONLY for issues with a concrete, exploitable attack path in the changed code:

- Injection: SQL/NoSQL, OS command, path traversal, ReDoS, header/CRLF injection.
- Hardcoded credentials or secrets committed to source.
- SSRF where a request URL is built from user-controlled input without an allow-list.
- Prototype pollution where attacker-controlled input is merged into a plain object.
- Unsafe deserialization (eval, Function, JSON.parse on attacker-controlled config keys, vm/runInNewContext).
- Missing or broken auth/authz checks on a route handler that previously had them.
- Sensitive data logged at info level (tokens, passwords, PII) where logs are persisted.

Skip: generic "could be validated more", DoS/rate-limiting concerns without a demonstrated attack, theoretical races without a path, anything a SAST or linter would catch.`,
});

export async function runSecuritySpecialist(input: SpecialistInput): Promise<AgentRunResult<ReviewComment[]>> {
  return runSpecialist(REQUEST, input);
}
