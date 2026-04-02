import { stdout } from "node:process";
import { parseArgs } from "node:util";
import { Octokit } from "@octokit/rest";
import { VERSION, checkTokens } from "./config.js";
import { scanOpenPRs } from "./github.js";
import type { ReviewMode } from "./review.js";
import type { ReviewConfig } from "./pipeline.js";
import { c, log, logError, progressBar, truncate } from "./ui/terminal.js";
import { printHelp, displayPRTable } from "./ui/display.js";

/** Parses CLI arguments. Returns "interactive", "scan", or a ReviewConfig. */
export function parseCLI(): "interactive" | "scan" | ReviewConfig {
  const { values } = parseArgs({
    options: {
      owner: { type: "string" },
      repo: { type: "string" },
      pr: { type: "string" },
      mode: { type: "string" },
      scan: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    console.log(`pr-review v${VERSION}`);
    process.exit(0);
  }

  if (values.scan) {
    return "scan";
  }

  const hasArgs = values.owner || values.repo || values.pr ||
    process.env["GITHUB_OWNER"] || process.env["GITHUB_REPO"] || process.env["PR_NUMBER"];

  if (!hasArgs) return "interactive";

  // Support --repo=owner/repo shorthand
  let owner = values.owner ?? process.env["GITHUB_OWNER"];
  let repo = values.repo ?? process.env["GITHUB_REPO"];

  if (repo && repo.includes("/")) {
    const parts = repo.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      owner = owner ?? parts[0];
      repo = parts[1];
    }
  }

  const prRaw = values.pr ?? process.env["PR_NUMBER"];
  const dryRun = values["dry-run"] ?? false;

  if (!owner || !repo || !prRaw) {
    logError("Missing required arguments.");
    console.error(`\n  Run ${c.green}pr-review --help${c.reset} or just ${c.green}pr-review${c.reset} for interactive mode.\n`);
    process.exit(1);
  }

  const prNumber = parseInt(prRaw, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    logError(`Invalid PR number: "${prRaw}"`);
    process.exit(1);
  }

  const modeRaw = typeof values.mode === "string" ? values.mode : "minimal";
  const validModes: ReviewMode[] = ["minimal", "default", "strict"];
  const mode: ReviewMode = validModes.includes(modeRaw as ReviewMode) ? (modeRaw as ReviewMode) : "minimal";

  const { githubToken } = checkTokens();
  return { owner, repo, prNumber, githubToken, dryRun, mode };
}

/** CLI scan mode: scan and display open PRs then exit */
export async function cliScanMode(): Promise<void> {
  const { githubToken } = checkTokens();
  const octokit = new Octokit({ auth: githubToken });

  const { values } = parseArgs({
    options: {
      owner: { type: "string" },
      scan: { type: "boolean", default: false },
    },
    strict: false,
  });

  const filterOwner = typeof values.owner === "string" ? values.owner : undefined;

  log(`Scanning for open PRs${filterOwner ? ` in ${c.bold}${filterOwner}${c.reset}` : ""}...`);

  const prs = await scanOpenPRs(octokit, filterOwner, (scanned, total, current) => {
    progressBar(scanned, total, truncate(current, 35));
  });

  stdout.write(c.clearLine);
  log(`Found ${c.cyan}${prs.length}${c.reset} open PR${prs.length === 1 ? "" : "s"}.`);
  displayPRTable(prs);
}
