import { c, clear, hr, scoreBar, truncate } from "./terminal.js";
import { VERSION } from "../config.js";
const sessionHistory = [];
/** Adds a review to session history */
export function addToHistory(entry) {
    sessionHistory.push(entry);
}
/** Returns the session review history */
export function getHistory() {
    return sessionHistory;
}
// ─── Banner ─────────────────────────────────────────────────
/** Prints the compact header bar */
export function printBanner() {
    clear();
    console.log(`\n  ${c.yellow}${c.bold}NodeTS PR Bot${c.reset} ${c.dim}v${VERSION}${c.reset}\n`);
}
/** Main screen: header + status + menu. One unified layout. */
export function printMainScreen(opts) {
    clear();
    console.log("");
    console.log(`  ${c.yellow}${c.bold}NodeTS PR Bot${c.reset} ${c.dim}v${VERSION}${c.reset}`);
    console.log(`  ${c.dim}${opts.username} · ${opts.prCount} open PRs${c.reset}`);
    console.log("");
    console.log(`  ${c.dim}${hr(40)}${c.reset}`);
    console.log("");
    console.log(`  ${c.yellow}1${c.reset}  Show open PRs`);
    console.log(`  ${c.yellow}2${c.reset}  Review by URL`);
    console.log(`  ${c.yellow}3${c.reset}  Rescan PRs`);
    console.log(`  ${c.yellow}4${c.reset}  History`);
    console.log(`  ${c.dim}q  Exit${c.reset}`);
    console.log("");
}
// ─── Help ───────────────────────────────────────────────────
export function printHelp() {
    console.log(`
${c.bold}${c.yellow}  pr-review${c.reset} — AI code review for Node.js/TS/JS

${c.bold}USAGE${c.reset}
  ${c.green}pr-review${c.reset}                             ${c.dim}# interactive mode${c.reset}
  ${c.green}pr-review${c.reset} ${c.yellow}--repo${c.reset}=owner/repo ${c.yellow}--pr${c.reset}=<n>
  ${c.green}pr-review${c.reset} ${c.yellow}--scan${c.reset}                        ${c.dim}# scan open PRs${c.reset}
  ${c.green}pr-review${c.reset} ${c.yellow}--scan${c.reset} ${c.yellow}--owner${c.reset}=<user>

${c.bold}OPTIONS${c.reset}
  ${c.yellow}--owner${c.reset}       Repository owner (org or user)
  ${c.yellow}--repo${c.reset}        Repository name, or owner/repo format
  ${c.yellow}--pr${c.reset}          Pull request number
  ${c.yellow}--scan${c.reset}        Scan for open PRs across your repos
  ${c.yellow}--dry-run${c.reset}     Review locally without posting to GitHub
  ${c.yellow}--help${c.reset}        Show this help
  ${c.yellow}--version${c.reset}     Show version

${c.bold}ENVIRONMENT${c.reset}
  ${c.dim}GITHUB_TOKEN${c.reset}       GitHub PAT ${c.red}(required)${c.reset}
  ${c.dim}ANTHROPIC_API_KEY${c.reset}  Anthropic key ${c.red}(required)${c.reset}
`);
}
// ─── PR Table ───────────────────────────────────────────────
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60)
        return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days}d`;
    return `${Math.floor(days / 30)}mo`;
}
function staleBadge(dateStr) {
    const days = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
    if (days > 14)
        return ` ${c.red}stale${c.reset}`;
    if (days > 7)
        return ` ${c.yellow}aging${c.reset}`;
    return "";
}
export function displayPRTable(prs) {
    if (prs.length === 0) {
        console.log(`\n  ${c.dim}No open PRs found.${c.reset}\n`);
        return;
    }
    console.log("");
    prs.forEach((pr, i) => {
        const num = `${c.yellow}${String(i + 1).padStart(2)}${c.reset}`;
        const repo = truncate(`${pr.owner}/${pr.repo}`, 28);
        const prNum = `${c.dim}#${pr.number}${c.reset}`;
        const title = `${c.dim}${truncate(pr.title, 40)}${c.reset}`;
        const age = timeAgo(pr.updatedAt);
        const badge = pr.draft ? `${c.dim} draft${c.reset}` : staleBadge(pr.updatedAt);
        console.log(`  ${num}  ${repo} ${prNum}  ${title}  ${c.dim}${age}${c.reset}${badge}`);
    });
    console.log("");
}
// ─── Review Summary ─────────────────────────────────────────
export function printSummary(verdict, score, blocking, nonBlocking, praise, durationSec) {
    const vc = verdict === "APPROVE" ? c.green : verdict === "REQUEST_CHANGES" ? c.red : c.yellow;
    console.log("");
    console.log(`  ${c.dim}${hr(36)}${c.reset}`);
    console.log(`  ${c.bold}Verdict${c.reset}      ${vc}${c.bold}${verdict}${c.reset}`);
    console.log(`  ${c.bold}Score${c.reset}        ${scoreBar(score)}`);
    if (blocking > 0)
        console.log(`  ${c.bold}Blocking${c.reset}     ${c.red}${blocking}${c.reset}`);
    if (nonBlocking > 0)
        console.log(`  ${c.bold}Warnings${c.reset}     ${c.yellow}${nonBlocking}${c.reset}`);
    if (praise > 0)
        console.log(`  ${c.bold}Praise${c.reset}       ${c.dim}${praise}${c.reset}`);
    if (durationSec !== undefined)
        console.log(`  ${c.bold}Time${c.reset}         ${c.dim}${durationSec.toFixed(1)}s${c.reset}`);
    console.log(`  ${c.dim}${hr(36)}${c.reset}`);
    console.log("");
}
// ─── Session History Display ────────────────────────────────
export function displayHistory() {
    if (sessionHistory.length === 0) {
        console.log(`\n  ${c.dim}No reviews in this session yet.${c.reset}\n`);
        return;
    }
    console.log(`\n  ${c.bold}Session History${c.reset} ${c.dim}(${sessionHistory.length} review${sessionHistory.length === 1 ? "" : "s"})${c.reset}\n`);
    sessionHistory.forEach((h, i) => {
        const vc = h.verdict === "APPROVE" ? c.green : h.verdict === "REQUEST_CHANGES" ? c.red : c.yellow;
        const icon = h.verdict === "APPROVE" ? "✓" : h.verdict === "REQUEST_CHANGES" ? "✗" : "?";
        console.log(`  ${c.dim}${String(i + 1).padStart(2)}.${c.reset} ${c.bold}${h.repo}${c.reset} #${h.pr} — ${vc}${icon} ${h.verdict}${c.reset} ${scoreBar(h.score)} ${c.dim}${h.duration.toFixed(1)}s${c.reset}`);
    });
    console.log("");
}
//# sourceMappingURL=display.js.map