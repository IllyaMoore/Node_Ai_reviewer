/** Decodes a GitHub Contents API base64 file payload. */
function decodeBase64(content) {
    return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf-8");
}
/** Returns the unique parent directories ("" for root) of all changed files. */
function changedDirectories(filenames) {
    const dirs = new Set([""]);
    for (const file of filenames) {
        const parts = file.split("/");
        parts.pop();
        for (let i = 0; i <= parts.length; i++) {
            dirs.add(parts.slice(0, i).join("/"));
        }
    }
    return [...dirs];
}
/**
 * Fetches CLAUDE.md from the repo root and from each directory that contains a
 * changed file (and their ancestors). Missing files are silently skipped.
 *
 * Result is concatenated, deepest-first so the most-specific rules appear last.
 */
export async function fetchClaudeMd(octokit, owner, repo, ref, changedFiles) {
    const dirs = changedDirectories(changedFiles);
    const candidatePaths = dirs.map((d) => (d === "" ? "CLAUDE.md" : `${d}/CLAUDE.md`));
    const results = await Promise.all(candidatePaths.map(async (path) => {
        try {
            const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
            if (Array.isArray(data) || data.type !== "file" || !("content" in data))
                return null;
            return { path, content: decodeBase64(data.content) };
        }
        catch (error) {
            if (error instanceof Error && "status" in error && error.status === 404) {
                return null;
            }
            // For non-404 errors, swallow and continue — CLAUDE.md is best-effort context.
            return null;
        }
    }));
    return results.filter((r) => r !== null);
}
/** Joins multiple CLAUDE.md files into a single string for prompt injection. */
export function formatClaudeMdContext(files) {
    if (files.length === 0)
        return "";
    return files
        .map((f) => `### ${f.path}\n\n${f.content.trim()}`)
        .join("\n\n---\n\n");
}
//# sourceMappingURL=fetchClaudeMd.js.map