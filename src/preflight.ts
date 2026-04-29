import type { PRData, ReviewResult } from "./types.js";

/** Decision returned by the preflight gate. */
export interface GateDecision {
  action: "review" | "auto-approve";
  reason: string;
}

/** Filename patterns that always count as docs/non-code. */
const DOC_PATTERNS = [
  /\.md$/i,
  /\.mdx$/i,
  /\.txt$/i,
  /^docs?\//i,
  /^README/i,
  /^CHANGELOG/i,
  /^LICENSE/i,
  /^CONTRIBUTING/i,
  /^CODE_OF_CONDUCT/i,
];

/** Filename patterns that count as lockfiles. */
const LOCKFILE_PATTERNS = [
  /^package-lock\.json$/i,
  /^yarn\.lock$/i,
  /^pnpm-lock\.yaml$/i,
  /^bun\.lockb?$/i,
  /^Cargo\.lock$/i,
  /^poetry\.lock$/i,
  /^Gemfile\.lock$/i,
  /^composer\.lock$/i,
  /^go\.sum$/i,
];

function matches(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

/**
 * Decides whether a PR is worth reviewing. Pure heuristic — no LLM cost.
 * Auto-approves docs-only PRs and lockfile-only bumps. Everything else flows
 * through to the full review pipeline.
 */
export function decideGate(prData: PRData): GateDecision {
  if (prData.files.length === 0) {
    return { action: "auto-approve", reason: "PR contains no file changes" };
  }

  const allDocs = prData.files.every((f) => matches(f.filename, DOC_PATTERNS));
  if (allDocs) {
    return { action: "auto-approve", reason: "documentation-only changes" };
  }

  const allLockfiles = prData.files.every((f) => matches(f.filename, LOCKFILE_PATTERNS));
  if (allLockfiles) {
    return { action: "auto-approve", reason: "lockfile-only update" };
  }

  return { action: "review", reason: "code changes present" };
}

/**
 * Builds the APPROVE result returned when the gate short-circuits.
 * The summary explains why no model-backed review ran.
 */
export function gateAutoApprove(reason: string): ReviewResult {
  return {
    summary:
      `✅ **Auto-approved by preflight gate.** Reason: ${reason}.\n\n` +
      `No model-backed review was run because the changes do not touch executable code. A human is still welcome to take a look — for science.`,
    verdict: "APPROVE",
    score: 8,
    blocking: [],
    non_blocking: [],
    praise: [],
    questions: [],
  };
}
