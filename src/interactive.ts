import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Octokit } from "@octokit/rest";
import { checkTokens } from "./config.js";
import { scanOpenPRs, getAuthenticatedUser } from "./github.js";
import type { OpenPR } from "./github.js";
import { runReview } from "./pipeline.js";
import type { ReviewMode } from "./review.js";
import { c, log, logError, progressBar, truncate, clear } from "./ui/terminal.js";
import { ask, confirm, pickNumber } from "./ui/prompts.js";
import { printBanner, displayPRTable } from "./ui/display.js";

/** Interactive mode: main menu loop with PR scanning, review, and settings */
export async function interactiveMode(): Promise<void> {
  const { githubToken } = checkTokens();
  const octokit = new Octokit({ auth: githubToken });

  let username = "";
  try {
    username = await getAuthenticatedUser(octokit);
  } catch {
    logError("Failed to authenticate with GitHub. Check your GITHUB_TOKEN.");
    process.exit(1);
  }

  // Scan open PRs at startup
  console.log(`  Logged in as ${c.bold}${c.green}${username}${c.reset}\n`);
  log(`Scanning open PRs...`);
  let cachedPRs: OpenPR[] = [];
  try {
    cachedPRs = await scanOpenPRs(octokit, username, (scanned, total, current) => {
      progressBar(scanned, total, truncate(current, 35));
    });
    stdout.write(c.clearLine);
    log(`Found ${c.cyan}${cachedPRs.length}${c.reset} open PR${cachedPRs.length === 1 ? "" : "s"}`);
  } catch {
    stdout.write(c.clearLine);
    log(`${c.yellow}Could not scan PRs${c.reset}`);
  }

  let currentMode: ReviewMode = "minimal";

  const rl = createInterface({ input: stdin, output: stdout });

  const modeLabel = (): string => {
    const labels: Record<ReviewMode, string> = {
      minimal: `${c.green}minimal${c.reset}`,
      default: `default`,
      strict: `${c.red}strict${c.reset}`,
    };
    return labels[currentMode];
  };

  const drawMenu = (): void => {
    clear();
    printBanner();
    console.log(`  ${c.bold}${c.green}${username}${c.reset}  ${c.dim}·${c.reset}  ${c.cyan}${cachedPRs.length}${c.reset} open PRs  ${c.dim}·${c.reset}  mode: ${modeLabel()}\n`);
    console.log(`  ${c.bold}Main Menu${c.reset}\n`);
    console.log(`    ${c.cyan}1${c.reset})  Show open PRs`);
    console.log(`    ${c.cyan}2${c.reset})  Review by URL`);
    console.log(`    ${c.cyan}3${c.reset})  Rescan PRs`);
    console.log(`    ${c.cyan}4${c.reset})  Settings`);
    console.log(`    ${c.cyan}5${c.reset})  Exit`);
    console.log("");
  };

  try {
    while (true) {
      drawMenu();

      const choice = await ask(rl, "Choose an option");

      switch (choice) {
        case "1": {
          clear();
          printBanner();
          await menuShowPRs(rl, cachedPRs, githubToken, currentMode);
          break;
        }
        case "2": {
          clear();
          printBanner();
          await menuReviewByURL(rl, githubToken, currentMode);
          break;
        }
        case "3": {
          clear();
          printBanner();
          log(`Rescanning...`);
          try {
            cachedPRs = await scanOpenPRs(octokit, username, (scanned, total, current) => {
              progressBar(scanned, total, truncate(current, 35));
            });
            stdout.write(c.clearLine);
            log(`Found ${c.cyan}${cachedPRs.length}${c.reset} open PR${cachedPRs.length === 1 ? "" : "s"}`);
          } catch {
            stdout.write(c.clearLine);
            logError("Scan failed.");
          }
          await ask(rl, `${c.dim}Press Enter to continue${c.reset}`);
          break;
        }
        case "4": {
          clear();
          printBanner();
          currentMode = await menuSettings(rl, currentMode);
          break;
        }
        case "5":
        case "q":
        case "exit": {
          clear();
          console.log(`\n  ${c.dim}Goodbye!${c.reset}\n`);
          process.exit(0);
        }
        default: {
          // Invalid — just redraw
        }
      }
    }
  } finally {
    rl.close();
  }
}

// ─── Sub-menus (private to this module) ─────────────────────

async function menuSettings(rl: ReturnType<typeof createInterface>, currentMode: ReviewMode): Promise<ReviewMode> {
  const modes: ReviewMode[] = ["minimal", "default", "strict"];
  const descriptions: Record<ReviewMode, string> = {
    minimal: "only blocking issues, ultra-short",
    default: "balanced review",
    strict: "thorough, flag everything",
  };

  console.log(`  ${c.bold}Settings${c.reset}\n`);
  console.log(`  ${c.bold}Review mode:${c.reset}\n`);

  modes.forEach((m, i) => {
    const active = m === currentMode ? ` ${c.green}← current${c.reset}` : "";
    console.log(`    ${c.cyan}${i + 1}${c.reset})  ${m.padEnd(10)} ${c.dim}${descriptions[m]}${c.reset}${active}`);
  });

  console.log("");
  const choice = await ask(rl, "Select mode (or Enter to keep current)");

  if (!choice) return currentMode;

  const map: Record<string, ReviewMode> = {
    "1": "minimal", "2": "default", "3": "strict",
    minimal: "minimal", default: "default", strict: "strict",
  };

  const selected = map[choice];
  if (selected) {
    console.log(`\n  ${c.green}✓${c.reset} Mode set to ${c.bold}${selected}${c.reset}`);
    await ask(rl, `${c.dim}Press Enter to continue${c.reset}`);
    return selected;
  }

  return currentMode;
}

async function menuShowPRs(rl: ReturnType<typeof createInterface>, prs: OpenPR[], githubToken: string, mode: ReviewMode): Promise<void> {
  displayPRTable(prs);

  if (prs.length === 0) {
    await ask(rl, `${c.dim}Press Enter to go back${c.reset}`);
    return;
  }

  const pick = await pickNumber(rl, "Select a PR to review (or 0 to go back)", prs.length);
  if (pick <= 0) return;

  const selected = prs[pick - 1]!;
  console.log(`\n  Selected: ${c.bold}${selected.owner}/${selected.repo}${c.reset} ${c.cyan}#${selected.number}${c.reset} — ${selected.title}\n`);

  const dryRun = await confirm(rl, "Dry run?", false);

  clear();
  printBanner();
  await runReview({
    owner: selected.owner,
    repo: selected.repo,
    prNumber: selected.number,
    githubToken,
    dryRun,
    mode,
  });
  await ask(rl, `${c.dim}Press Enter to go back to menu${c.reset}`);
}

async function menuReviewByURL(rl: ReturnType<typeof createInterface>, githubToken: string, mode: ReviewMode): Promise<void> {
  console.log("");
  const url = await ask(rl, "Paste GitHub PR URL");

  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    console.log(`  ${c.red}Invalid URL.${c.reset} Expected: https://github.com/owner/repo/pull/123\n`);
    await ask(rl, `${c.dim}Press Enter to go back${c.reset}`);
    return;
  }

  const [, owner, repo, prStr] = match;
  const prNumber = parseInt(prStr!, 10);

  console.log(`  ${c.green}✓${c.reset} ${c.bold}${owner}/${repo}${c.reset} PR ${c.cyan}#${prNumber}${c.reset}\n`);

  const dryRun = await confirm(rl, "Dry run?", false);

  clear();
  printBanner();
  await runReview({ owner: owner!, repo: repo!, prNumber, githubToken, dryRun, mode });
  await ask(rl, `${c.dim}Press Enter to go back to menu${c.reset}`);
}
