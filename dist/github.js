/**
 * Extracts the set of new-file line numbers commentable on a unified diff patch.
 * Includes both added (`+`) and context (` `) lines — GitHub accepts either.
 */
export function commentableLines(patch) {
    const set = new Set();
    if (!patch)
        return set;
    let line = 0;
    for (const row of patch.split("\n")) {
        const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
        if (m) {
            line = parseInt(m[1], 10);
            continue;
        }
        if (row.startsWith("+++"))
            continue;
        if (row.startsWith("+")) {
            set.add(line);
            line++;
        }
        else if (row.startsWith(" ")) {
            set.add(line);
            line++;
        }
        // "-" lines and other markers don't advance the new-file line counter
    }
    return set;
}
/** Builds a per-file map of commentable line numbers from PRData. */
export function buildCommentableMap(files) {
    const map = new Map();
    for (const f of files) {
        map.set(f.filename, commentableLines(f.patch));
    }
    return map;
}
/**
 * Fetches all relevant data for a pull request: metadata, diff, and changed files.
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (org or user)
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns PR metadata, unified diff, and list of changed files
 */
export async function fetchPRData(octokit, owner, repo, prNumber) {
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
    }
    catch (error) {
        if (error instanceof Error && "status" in error && error.status === 404) {
            throw new Error(`PR #${prNumber} not found in ${owner}/${repo}. ` +
                `Check that the repo exists, the PR number is correct, and your GITHUB_TOKEN has access to this repository.`);
        }
        throw error;
    }
    const pr = prResponse.data;
    return {
        title: pr.title,
        body: pr.body,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        diff: diffResponse.data,
        files: filesResponse.data.map((f) => ({
            filename: f.filename,
            patch: f.patch,
        })),
    };
}
/**
 * Fetches the authenticated user's GitHub login.
 *
 * @param octokit - Authenticated Octokit instance
 * @returns GitHub username
 */
export async function getAuthenticatedUser(octokit) {
    const { data } = await octokit.users.getAuthenticated();
    return data.login;
}
/**
 * Fetches all repositories accessible to the authenticated user.
 *
 * @param octokit - Authenticated Octokit instance
 * @returns List of owner/repo strings
 */
export async function listUserRepos(octokit) {
    const repos = [];
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
export async function scanOpenPRs(octokit, filterOwner, onProgress) {
    let repos = await listUserRepos(octokit);
    if (filterOwner) {
        repos = repos.filter((r) => r.owner.toLowerCase() === filterOwner.toLowerCase());
    }
    const openPRs = [];
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
        }
        catch {
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
export async function postReviewComment(octokit, owner, repo, prNumber, body) {
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
 * Optional inline comments are filtered against the per-file commentable line map —
 * any comment targeting a line that isn't in the diff is dropped silently to avoid
 * a 422 from GitHub. Dropped comments are returned so the caller can fall back to
 * top-level body text.
 */
export async function submitReview(octokit, owner, repo, prNumber, verdict, body, inlineComments = [], commentable) {
    const eventMap = {
        APPROVE: "APPROVE",
        REQUEST_CHANGES: "REQUEST_CHANGES",
        NEEDS_DISCUSSION: "COMMENT",
    };
    const valid = [];
    const dropped = [];
    for (const ic of inlineComments) {
        const lines = commentable?.get(ic.path);
        if (lines && lines.has(ic.line)) {
            valid.push(ic);
        }
        else {
            dropped.push(ic);
        }
    }
    const payload = {
        owner,
        repo,
        pull_number: prNumber,
        event: eventMap[verdict],
        body,
        ...(valid.length > 0
            ? { comments: valid.map((c) => ({ path: c.path, line: c.line, side: "RIGHT", body: c.body })) }
            : {}),
    };
    try {
        await octokit.pulls.createReview(payload);
    }
    catch (error) {
        // 422 commonly means: review on own PR (can't APPROVE/REQUEST_CHANGES) OR
        // a stale inline comment slipped past our filter. Retry as COMMENT, body-only.
        if (error instanceof Error && "status" in error && error.status === 422) {
            await octokit.pulls.createReview({
                owner,
                repo,
                pull_number: prNumber,
                event: "COMMENT",
                body,
            });
            return { posted: 0, dropped: [...dropped, ...valid] };
        }
        throw error;
    }
    return { posted: valid.length, dropped };
}
//# sourceMappingURL=github.js.map