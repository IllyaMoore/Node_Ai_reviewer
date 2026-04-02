import { c, clear, hr } from "./terminal.js";
import { VERSION } from "../config.js";
import type { OpenPR } from "../github.js";

/** Prints the app banner and clears screen */
export function printBanner(): void {
  clear();
  console.log(`
${c.cyan}${c.bold}
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   NodeTS PR Bot                          ║
  ║   Version  v${VERSION}                          ║
  ║                                          ║
  ╚══════════════════════════════════════════╝${c.reset}
`);
}

/** Prints CLI help text */
export function printHelp(): void {
  console.log(`
${c.bold}${c.cyan}  pr-review${c.reset} — AI code review for Node.js/TS/JS

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
  ${c.yellow}--mode${c.reset}        Review mode: minimal, default, strict
  ${c.yellow}--help${c.reset}        Show this help
  ${c.yellow}--version${c.reset}     Show version

${c.bold}ENVIRONMENT${c.reset}
  ${c.dim}GITHUB_TOKEN${c.reset}       GitHub PAT ${c.red}(required)${c.reset}
  ${c.dim}ANTHROPIC_API_KEY${c.reset}  Anthropic key ${c.red}(required)${c.reset}
`);
}

/** Formats a relative time string */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Displays PRs as a styled table */
export function displayPRTable(prs: OpenPR[]): void {
  if (prs.length === 0) {
    console.log(`\n  ${c.dim}No open PRs found.${c.reset}\n`);
    return;
  }

  console.log(`\n  ${c.bold}Found ${c.cyan}${prs.length}${c.reset}${c.bold} open PR${prs.length === 1 ? "" : "s"}:${c.reset}\n`);
  console.log(`  ${hr(72)}`);
  console.log(`  ${c.dim}  #   PR    Repository                  Title                    Updated${c.reset}`);
  console.log(`  ${hr(72)}`);

  prs.forEach((pr, i) => {
    const num = `${c.bold}${String(i + 1).padStart(3)}${c.reset}`;
    const prNum = `${c.cyan}#${String(pr.number).padEnd(5)}${c.reset}`;
    const repoStr = truncateStr(`${pr.owner}/${pr.repo}`, 26).padEnd(26);
    const title = truncateStr(pr.title, 24).padEnd(24);
    const updated = `${c.dim}${timeAgo(pr.updatedAt).padStart(7)}${c.reset}`;
    const draft = pr.draft ? ` ${c.dim}[draft]${c.reset}` : "";
    const size = pr.changedFiles > 0
      ? ` ${c.green}+${pr.additions}${c.reset}${c.red}-${pr.deletions}${c.reset}`
      : "";

    console.log(`  ${num}  ${prNum} ${repoStr} ${title} ${updated}${draft}${size}`);
  });

  console.log(`  ${hr(72)}\n`);
}

/** Local truncate to avoid circular dep with terminal.ts */
function truncateStr(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/** Prints styled review summary */
export function printSummary(verdict: string, score: number, blocking: number, nonBlocking: number, praise: number): void {
  const vc = verdict === "APPROVE" ? c.green : verdict === "REQUEST_CHANGES" ? c.red : c.yellow;
  const sc = score >= 7 ? c.green : score >= 4 ? c.yellow : c.red;

  console.log(`
  ${hr(34)}
  ${c.bold}  Review Summary${c.reset}
  ${hr(34)}
    Verdict       ${vc}${c.bold}${verdict}${c.reset}
    Score         ${sc}${c.bold}${score}/10${c.reset}
    Blocking      ${blocking > 0 ? c.red : c.green}${blocking}${c.reset}
    Non-blocking  ${c.yellow}${nonBlocking}${c.reset}
    Praise        ${c.green}${praise}${c.reset}
  ${hr(34)}
`);
}
