import type { ReviewComment } from "./types.js";

/** Severity ordering — used to pick the strongest finding when deduping. */
const SEVERITY_RANK: Record<ReviewComment["severity"], number> = {
  critical: 4,
  major: 3,
  minor: 2,
  nit: 1,
};

/** Returns true if a finding should be treated as blocking. */
export function isBlocking(c: ReviewComment): boolean {
  return c.severity === "critical" || c.severity === "major";
}

/**
 * Deduplicates findings across multiple agents. Two findings collide when they
 * target the same file:line:category. The strongest severity wins; the stronger
 * finding's issue/suggestion text is kept.
 */
export function dedupeFindings(findings: ReviewComment[]): ReviewComment[] {
  const byKey = new Map<string, ReviewComment>();
  for (const f of findings) {
    const key = `${f.file}:${f.line}:${f.category}`;
    const existing = byKey.get(key);
    if (!existing || SEVERITY_RANK[f.severity] > SEVERITY_RANK[existing.severity]) {
      byKey.set(key, f);
    }
  }
  return [...byKey.values()];
}

/** Splits a deduped finding list into blocking + non-blocking buckets. */
export function splitFindings(findings: ReviewComment[]): {
  blocking: ReviewComment[];
  non_blocking: ReviewComment[];
} {
  const blocking: ReviewComment[] = [];
  const non_blocking: ReviewComment[] = [];
  for (const f of findings) {
    if (isBlocking(f)) blocking.push(f);
    else non_blocking.push(f);
  }
  return { blocking, non_blocking };
}

/**
 * Sorts findings by severity (descending) then file/line. Used to give the most
 * important issues a stable position at the top of the list.
 */
export function rankFindings(findings: ReviewComment[]): ReviewComment[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
}
