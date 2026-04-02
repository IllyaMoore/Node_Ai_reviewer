import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { c, logError } from "./ui/terminal.js";

export const VERSION = "0.1";

/** Loads .env file into process.env (no-op if file doesn't exist) */
export function loadEnv(): void {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found — that's fine
  }
}

/** Validates required environment tokens are set */
export function checkTokens(): { githubToken: string } {
  const githubToken = process.env["GITHUB_TOKEN"];
  if (!githubToken) {
    logError("GITHUB_TOKEN is not set.");
    console.error(`\n  Add it to ${c.dim}.env${c.reset} or export in your shell.\n`);
    process.exit(1);
  }
  if (!process.env["ANTHROPIC_API_KEY"]) {
    logError("ANTHROPIC_API_KEY is not set.");
    console.error(`\n  Get a key at ${c.cyan}https://console.anthropic.com/settings/keys${c.reset}\n`);
    process.exit(1);
  }
  return { githubToken };
}
