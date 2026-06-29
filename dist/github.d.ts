import { Octokit } from "@octokit/rest";
import type { PRData } from "./types.js";
/** A single inline review comment to attach to a PR review. */
export interface InlineReviewComment {
    path: string;
    line: number;
    body: string;
}
/**
 * Extracts the set of new-file line numbers commentable on a unified diff patch.
 * Includes both added (`+`) and context (` `) lines — GitHub accepts either.
 */
export declare function commentableLines(patch: string | undefined): Set<number>;
/** Builds a per-file map of commentable line numbers from PRData. */
export declare function buildCommentableMap(files: PRData["files"]): Map<string, Set<number>>;
/**
 * Fetches all relevant data for a pull request: metadata, diff, and changed files.
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (org or user)
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns PR metadata, unified diff, and list of changed files
 */
export declare function fetchPRData(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<PRData>;
/** Info about an open pull request for the scanner UI */
export interface OpenPR {
    number: number;
    title: string;
    user: string;
    repo: string;
    owner: string;
    updatedAt: string;
    draft: boolean;
    labels: string[];
    additions: number;
    deletions: number;
    changedFiles: number;
    url: string;
}
/**
 * Fetches the authenticated user's GitHub login.
 *
 * @param octokit - Authenticated Octokit instance
 * @returns GitHub username
 */
export declare function getAuthenticatedUser(octokit: Octokit): Promise<string>;
/**
 * Fetches all repositories accessible to the authenticated user.
 *
 * @param octokit - Authenticated Octokit instance
 * @returns List of owner/repo strings
 */
export declare function listUserRepos(octokit: Octokit): Promise<Array<{
    owner: string;
    name: string;
}>>;
/**
 * Scans all accessible repos (or a specific owner) for open pull requests.
 *
 * @param octokit - Authenticated Octokit instance
 * @param filterOwner - Optional owner to filter repos by
 * @param onProgress - Optional callback for progress updates
 * @returns List of open PRs across repos
 */
export declare function scanOpenPRs(octokit: Octokit, filterOwner?: string, onProgress?: (scanned: number, total: number, current: string) => void): Promise<OpenPR[]>;
/**
 * Posts a markdown comment on a pull request.
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param body - Markdown body of the comment
 */
export declare function postReviewComment(octokit: Octokit, owner: string, repo: string, prNumber: number, body: string): Promise<void>;
/**
 * Submits a formal GitHub pull request review (APPROVE, REQUEST_CHANGES, or COMMENT).
 *
 * Optional inline comments are filtered against the per-file commentable line map —
 * any comment targeting a line that isn't in the diff is dropped silently to avoid
 * a 422 from GitHub. Dropped comments are returned so the caller can fall back to
 * top-level body text.
 */
export declare function submitReview(octokit: Octokit, owner: string, repo: string, prNumber: number, verdict: "APPROVE" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION", body: string, inlineComments?: InlineReviewComment[], commentable?: Map<string, Set<number>>): Promise<{
    posted: number;
    dropped: InlineReviewComment[];
}>;
//# sourceMappingURL=github.d.ts.map