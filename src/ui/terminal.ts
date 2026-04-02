import { stdout } from "node:process";

/** ANSI color/style helpers */
export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgCyan: "\x1b[46m",
  bgMagenta: "\x1b[45m",
  clearLine: "\x1b[2K\x1b[0G",
  clearScreen: "\x1b[2J\x1b[3J\x1b[H",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
};

/** Clears the terminal and moves cursor to top-left */
export function clear(): void {
  stdout.write(c.clearScreen);
}

/** Returns a formatted timestamp string */
export function ts(): string {
  return `${c.dim}[${new Date().toTimeString().slice(0, 8)}]${c.reset}`;
}

/** Logs a message with timestamp */
export function log(msg: string): void {
  console.log(`${ts()} ${msg}`);
}

/** Logs an error with timestamp */
export function logError(msg: string): void {
  console.error(`${ts()} ${c.red}${msg}${c.reset}`);
}

/** Draws a progress bar with percentage */
export function progressBar(current: number, total: number, label: string): void {
  const width = 30;
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = `${c.cyan}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
  const percent = `${Math.round(pct * 100)}%`.padStart(4);
  stdout.write(`${c.clearLine}  ${bar} ${c.bold}${percent}${c.reset}  ${c.dim}${label}${c.reset}`);
}

/** Draws a horizontal line */
export function hr(width = 50): string {
  return `${c.dim}${"─".repeat(width)}${c.reset}`;
}

/** Truncates a string to max length */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
