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
  let prResponse, diffResponse, filesResponse;
  try {
    [prResponse, diffResponse, filesResponse] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number: prNumber }),
      octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: { format: "diff" },
      }),
      octokit.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 300 }),
    ]);
  } catch (error: unknown) {
    if (error instanceof Error && "status" in error && (error as { status: number }).status === 404) {
      throw new Error(
        `PR #${prNumber} not found in ${owner}/${repo}. ` +
        `Check that the repo exists, the PR number is correct, and your GITHUB_TOKEN has access to this repository.`
      );
    }
    throw error;
  }

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
export async function getAuthenticatedUser(octokit: Octokit): Promise<string> {
  const { data } = await octokit.users.getAuthenticated();
  return data.login;
}

/**
 * Fetches all repositories accessible to the authenticated user.
 *
 * @param octokit - Authenticated Octokit instance
 * @returns List of owner/repo strings
 */
export async function listUserRepos(octokit: Octokit): Promise<Array<{ owner: string; name: string }>> {
  const repos: Array<{ owner: string; name: string }> = [];
  for await (const response of octokit.paginate.iterator(octokit.repos.listForAuthenticatedUser, {
    per_page: 100,
    sort: "updated",
  })) {
    for (const repo of response.data) {
      repos.push({ owner: repo.owner.login, name: repo.name });
    }
  }
  return repos;
}

/**
 * Scans all accessible repos (or a specific owner) for open pull requests.
 *
 * @param octokit - Authenticated Octokit instance
 * @param filterOwner - Optional owner to filter repos by
 * @param onProgress - Optional callback for progress updates
 * @returns List of open PRs across repos
 */
export async function scanOpenPRs(
  octokit: Octokit,
  filterOwner?: string,
  onProgress?: (scanned: number, total: number, current: string) => void
): Promise<OpenPR[]> {
  let repos = await listUserRepos(octokit);

  if (filterOwner) {
    repos = repos.filter((r) => r.owner.toLowerCase() === filterOwner.toLowerCase());
  }

  const openPRs: OpenPR[] = [];
  let scanned = 0;

  for (const repo of repos) {
    scanned++;
    onProgress?.(scanned, repos.length, `${repo.owner}/${repo.name}`);

    try {
      const { data: pulls } = await octokit.pulls.list({
        owner: repo.owner,
        repo: repo.name,
        state: "open",
        per_page: 30,
        sort: "updated",
        direction: "desc",
      });

      for (const pr of pulls) {
        openPRs.push({
          number: pr.number,
          title: pr.title,
          user: pr.user?.login ?? "unknown",
          repo: repo.name,
          owner: repo.owner,
          updatedAt: pr.updated_at,
          draft: pr.draft ?? false,
          labels: pr.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
          additions: 0,
          deletions: 0,
          changedFiles: 0,
          url: pr.html_url,
        });
      }
    } catch {
      // Skip repos we can't access
    }
  }

  // Sort by most recently updated
  openPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return openPRs;
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
