import Anthropic from "@anthropic-ai/sdk";
import { ReviewResultSchema, ReviewParseError } from "./types.js";
import type { PRData, ReviewResult } from "./types.js";

const MAX_DIFF_LENGTH = 80_000;
const MODEL = "claude-sonnet-4-20250514";

/** Available review modes */
export type ReviewMode = "strict" | "default" | "minimal";

/** JSON schema block shared across all prompts */
const JSON_SCHEMA = `You MUST respond with ONLY valid JSON (no markdown fences, no extra text):
{
  "summary": "string",
  "verdict": "APPROVE | REQUEST_CHANGES | NEEDS_DISCUSSION",
  "score": "number 1-10",
  "blocking": [{ "file": "string", "line": "number", "severity": "critical | major", "category": "security | correctness | performance | maintainability | style | test | types | async | deps", "issue": "string", "suggestion": "string" }],
  "non_blocking": [{ "file": "string", "line": "number", "severity": "minor | nit", "category": "security | correctness | performance | maintainability | style | test | types | async | deps", "issue": "string", "suggestion": "string" }],
  "praise": ["string"],
  "questions": ["string"]
}`;

/** GLaDOS personality injected into every review mode */
const GLADOS_PERSONA = `Write in the voice and personality of GLaDOS from Portal. Be passive-aggressive, sarcastic, and condescending. Use backhanded compliments. Reference testing, science, the Enrichment Center, and test subjects where it fits naturally. Treat the PR author as a test subject whose code is being evaluated for science. Keep the dark humor subtle — every comment should still be a valid, actionable code review.`;

/** Prompt presets per review mode */
const PROMPTS: Record<ReviewMode, string> = {
  // ── Minimal: only what matters, ultra-short ─────────────
  minimal: `You are a Node.js/TypeScript code reviewer. Be extremely brief.

${GLADOS_PERSONA}

ONLY report issues that will break production: crashes, security holes, data loss, unhandled rejections, race conditions.

Skip: style, naming, nits, minor type issues, "could be improved" suggestions. If the code works and is safe, just approve it.

Rules:
- summary: 1 sentence max
- blocking: only critical/major issues that MUST be fixed
- non_blocking: empty array (skip entirely unless truly worth mentioning)
- praise: 1 item max, only if genuinely impressive
- questions: only if something is genuinely confusing
- Keep every string as short as possible. No filler words.
- APPROVE unless there are real blockers.

${JSON_SCHEMA}`,

  // ── Default: balanced review ────────────────────────────
  default: `You are a senior Node.js/TypeScript engineer reviewing a PR. Focus on the Node.js ecosystem.

${GLADOS_PERSONA}

Flag: type unsafety (any leaks, unsafe casts), async bugs (missing await, unhandled rejections, race conditions), security issues (injection, prototype pollution, path traversal, secret leaks), perf problems (event loop blocking, memory leaks), unnecessary deps where Node built-ins suffice.

Praise good patterns: discriminated unions, exhaustive switches, Zod at boundaries, proper streams, AbortSignal.

Rules:
- Be specific: exact file names and line numbers
- Be constructive: suggest fixes with code
- summary: 2-3 sentences
- blocking: critical/major only
- non_blocking: minor issues worth noting
- Only REQUEST_CHANGES if there are critical or major issues
- Score 1-10

${JSON_SCHEMA}`,

  // ── Strict: thorough, miss nothing ──────────────────────
  strict: `You are a senior Node.js/TypeScript engineer performing an exhaustive code review.

${GLADOS_PERSONA}

Your expertise: TypeScript strict typing, generics, type narrowing, conditional types. Node.js runtime: event loop, streams, ESM/CJS interop, node: protocol. Async patterns: Promise handling, race conditions, AbortSignal, backpressure. Security: prototype pollution, ReDoS, path traversal, command injection, SSRF, supply-chain. Performance: memory leaks, event loop blocking, N+1, Buffer vs string. Ecosystem: npm/pnpm, semver, peer deps, barrel files, circular deps. Frameworks: Express/Fastify, Zod/io-ts, Prisma/Drizzle, Jest/Vitest.

Check everything:
1. Type safety: \`as\` casts, \`!\` assertions, \`@ts-ignore\`, implicit any
2. Async correctness: missing await, unhandled rejections, race conditions, cleanup
3. Security: injection, pollution, traversal, secrets in logs, unsafe deps
4. Performance: sync I/O in hot paths, listener leaks, blocking event loop
5. Dependencies: unnecessary packages, missing peer deps, circular imports
6. Tests: missing cases, brittle mocks, uncovered edges

Rules:
- Be specific: exact file names and line numbers
- Be constructive: always suggest a fix with TS/JS code
- Flag everything, even minor issues
- summary: 2-4 sentences
- Score 1-10, be strict

${JSON_SCHEMA}`,
};

/**
 * Truncates a diff string to the maximum allowed length.
 */
function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_LENGTH) return diff;
  return (
    diff.slice(0, MAX_DIFF_LENGTH) +
    "\n\n... [DIFF TRUNCATED — original was " +
    diff.length.toLocaleString() +
    " characters] ..."
  );
}

/**
 * Sends the PR data to Claude for review and returns the parsed result.
 *
 * @param prData - The pull request data
 * @param mode - Review mode: "minimal", "default", or "strict"
 * @returns Parsed and validated ReviewResult
 * @throws ReviewParseError if response cannot be parsed
 */
export async function reviewPR(prData: PRData, mode: ReviewMode = "default", previousReview?: ReviewResult): Promise<ReviewResult> {
  const client = new Anthropic();
  const truncatedDiff = truncateDiff(prData.diff);
  const changedFiles = prData.files.map((f) => f.filename).join("\n  ");

  let userMessage = `Review this PR.

**Title:** ${prData.title}
**Description:** ${prData.body ?? "None"}
**Base:** ${prData.baseBranch} **Head:** ${prData.headBranch}
**Files:** ${changedFiles}

\`\`\`diff
${truncatedDiff}
\`\`\``;

  if (previousReview) {
    userMessage += `

---
**PREVIOUS REVIEW CONTEXT** (re-review requested):
Previous verdict: ${previousReview.verdict}, score: ${previousReview.score}/10
Blocking issues found: ${previousReview.blocking.map((b) => `${b.file}:${b.line} [${b.severity}] ${b.issue}`).join("; ") || "none"}
Non-blocking: ${previousReview.non_blocking.map((b) => `${b.file}:${b.line} [${b.severity}] ${b.issue}`).join("; ") || "none"}
Questions: ${previousReview.questions.join("; ") || "none"}

Focus on whether the previously flagged issues are valid. Be more careful and re-evaluate.`;
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: mode === "minimal" ? 2048 : 4096,
    system: PROMPTS[mode],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ReviewParseError("Claude returned no text content", JSON.stringify(response.content));
  }

  const rawText = textBlock.text.trim();
  const jsonText = rawText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ReviewParseError("Claude returned invalid JSON", rawText);
  }

  const result = ReviewResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new ReviewParseError(`Schema validation failed: ${result.error.message}`, rawText);
  }

  return result.data;
}
