import type { Octokit } from "@octokit/rest";
/** A single CLAUDE.md file located in the repo. */
export interface ClaudeMdFile {
    path: string;
    content: string;
}
/**
 * Fetches CLAUDE.md from the repo root and from each directory that contains a
 * changed file (and their ancestors). Missing files are silently skipped.
 *
 * Result is concatenated, deepest-first so the most-specific rules appear last.
 */
export declare function fetchClaudeMd(octokit: Octokit, owner: string, repo: string, ref: string, changedFiles: string[]): Promise<ClaudeMdFile[]>;
/** Joins multiple CLAUDE.md files into a single string for prompt injection. */
export declare function formatClaudeMdContext(files: ClaudeMdFile[]): string;
//# sourceMappingURL=fetchClaudeMd.d.ts.map