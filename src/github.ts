import { Octokit } from "@octokit/rest";
import type { PRData } from "./types.js";

/**
 * Fetches all relevant data for a pull request: metadata, diff, and changed files.
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (org or user)
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns PR metadata, unified diff, and list of changed files
 */
export async function fetchPRData(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRData> {
  const [prResponse, diffResponse, filesResponse] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: prNumber }),
    octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: "diff" },
    }),
    octokit.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 300 }),
  ]);

  const pr = prResponse.data;

  return {
    title: pr.title,
    body: pr.body,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    diff: diffResponse.data as unknown as string,
    files: filesResponse.data.map((f) => ({
      filename: f.filename,
      patch: f.patch,
    })),
  };
}

/**
 * Posts a markdown comment on a pull request.
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param body - Markdown body of the comment
 */
export async function postReviewComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

/**
 * Submits a formal GitHub pull request review (APPROVE, REQUEST_CHANGES, or COMMENT).
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param verdict - Review verdict to map to GitHub review event
 * @param body - Review body text
 */
export async function submitReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  verdict: "APPROVE" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION",
  body: string
): Promise<void> {
  const eventMap: Record<string, "APPROVE" | "REQUEST_CHANGES" | "COMMENT"> = {
    APPROVE: "APPROVE",
    REQUEST_CHANGES: "REQUEST_CHANGES",
    NEEDS_DISCUSSION: "COMMENT",
  };

  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    event: eventMap[verdict],
    body,
  });
}
