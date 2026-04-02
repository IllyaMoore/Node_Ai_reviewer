import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Octokit } from "@octokit/rest";
import { checkTokens } from "./config.js";
import { scanOpenPRs, getAuthenticatedUser } from "./github.js";
import type { OpenPR } from "./github.js";
import { runReview } from "./pipeline.js";
import type { ReviewMode } from "./review.js";
import { c, log, logError, progressBar, truncate, clear, readKey } from "./ui/terminal.js";
import { ask } from "./ui/prompts.js";
import { printBanner, printMainScreen, displayPRTable, displayHistory } from "./ui/display.js";

/** Interactive mode: main menu loop */
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

  // Initial scan
  printBanner();
  console.log(`  ${c.dim}Logged in as${c.reset} ${c.bold}${username}${c.reset}\n`);
  log(`Scanning open PRs...`);
  let cachedPRs: OpenPR[] = [];
  try {
    cachedPRs = await scanOpenPRs(octokit, username, (scanned, total, current) => {
      progressBar(scanned, total, truncate(current, 35));
    });
    stdout.write(c.clearLine);
    log(`Found ${c.yellow}${cachedPRs.length}${c.reset} open PR${cachedPRs.length === 1 ? "" : "s"}`);
  } catch {
    stdout.write(c.clearLine);
    log(`${c.yellow}Could not scan PRs${c.reset}`);
  }

  let currentMode: ReviewMode = "minimal";

  const modeLabel = (): string => {
    const map: Record<ReviewMode, string> = {
      minimal: `${c.green}minimal${c.reset}`,
      default: `default`,
      strict: `${c.red}strict${c.reset}`,
    };
    return map[currentMode];
  };

  const drawMenu = (): void => {
    printMainScreen({ username, prCount: cachedPRs.length, mode: modeLabel() });
  };

  while (true) {
    drawMenu();
    const key = await readKey();

    switch (key) {
      case "1": {
        await menuShowPRs(cachedPRs, githubToken, currentMode);
        break;
      }
      case "2": {
        await menuReviewByURL(githubToken, currentMode);
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
          log(`Found ${c.yellow}${cachedPRs.length}${c.reset} open PR${cachedPRs.length === 1 ? "" : "s"}`);
        } catch {
          stdout.write(c.clearLine);
          logError("Scan failed.");
        }
        console.log(`\n  ${c.dim}Press any key...${c.reset}`);
        await readKey();
        break;
      }
      case "4": {
        currentMode = await menuSettings(currentMode);
        break;
      }
      case "5":
      case "h": {
        clear();
        printBanner();
        displayHistory();
        console.log(`  ${c.dim}Press any key...${c.reset}`);
        await readKey();
        break;
      }
      case "q":
      case "\x1b": {
        clear();
        console.log(`\n  ${c.dim}Goodbye!${c.reset}\n`);
        process.exit(0);
      }
    }
  }
}

// ─── Sub-menus ──────────────────────────────────────────────

async function menuSettings(currentMode: ReviewMode): Promise<ReviewMode> {
  clear();
  printBanner();

  const modes: ReviewMode[] = ["minimal", "default", "strict"];
  const desc: Record<ReviewMode, string> = {
    minimal: "only blocking issues, ultra-short",
    default: "balanced review",
    strict: "thorough, flag everything",
  };

  console.log(`  ${c.bold}Review mode${c.reset}\n`);
  modes.forEach((m, i) => {
    const cur = m === currentMode ? ` ${c.green}<-${c.reset}` : "";
    console.log(`  ${c.yellow}${i + 1}${c.reset}  ${m.padEnd(10)} ${c.dim}${desc[m]}${c.reset}${cur}`);
  });
  console.log(`\n  ${c.dim}Press 1-3 or any key to go back${c.reset}`);

  const key = await readKey();
  const map: Record<string, ReviewMode> = { "1": "minimal", "2": "default", "3": "strict" };
  return map[key] ?? currentMode;
}

async function menuShowPRs(prs: OpenPR[], githubToken: string, mode: ReviewMode): Promise<void> {
  clear();
  printBanner();
  displayPRTable(prs);

  if (prs.length === 0) {
    console.log(`  ${c.dim}Press any key...${c.reset}`);
    await readKey();
    return;
  }

  // Single-digit selection for PRs 1-9, or multi-digit with Enter
  console.log(`  ${c.dim}Press 1-${Math.min(prs.length, 9)} to select, 0 to go back${c.reset}`);
  const key = await readKey();

  if (key === "0" || key === "\x1b") return;

  const pick = parseInt(key, 10);
  if (isNaN(pick) || pick < 1 || pick > prs.length) return;

  const selected = prs[pick - 1]!;
  console.log(`\n  ${c.bold}${selected.owner}/${selected.repo}${c.reset} ${c.yellow}#${selected.number}${c.reset} ${c.dim}${selected.title}${c.reset}`);

  // Dry run? y/n single key
  console.log(`\n  ${c.dim}Dry run? y/${c.reset}${c.bold}N${c.reset}`);
  const dryKey = await readKey();
  const dryRun = dryKey === "y" || dryKey === "Y";

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
  console.log(`  ${c.dim}Press any key...${c.reset}`);
  await readKey();
}

async function menuReviewByURL(githubToken: string, mode: ReviewMode): Promise<void> {
  clear();
  printBanner();

  // URL requires text input — use readline
  const rl = createInterface({ input: stdin, output: stdout });
  const url = await ask(rl, "Paste GitHub PR URL");
  rl.close();

  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    console.log(`\n  ${c.red}Invalid URL.${c.reset} ${c.dim}Expected: github.com/owner/repo/pull/123${c.reset}`);
    console.log(`\n  ${c.dim}Press any key...${c.reset}`);
    await readKey();
    return;
  }

  const [, owner, repo, prStr] = match;
  const prNumber = parseInt(prStr!, 10);
  console.log(`  ${c.green}✓${c.reset} ${c.bold}${owner}/${repo}${c.reset} #${prNumber}`);

  // Dry run? y/n single key
  console.log(`\n  ${c.dim}Dry run? y/${c.reset}${c.bold}N${c.reset}`);
  const dryKey = await readKey();
  const dryRun = dryKey === "y" || dryKey === "Y";

  clear();
  printBanner();
  await runReview({ owner: owner!, repo: repo!, prNumber, githubToken, dryRun, mode });
  console.log(`  ${c.dim}Press any key...${c.reset}`);
  await readKey();
}
