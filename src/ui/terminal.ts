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
  const bar = `${c.yellow}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
  const percent = `${Math.round(pct * 100)}%`.padStart(4);
  stdout.write(`${c.clearLine}  ${bar} ${c.bold}${percent}${c.reset}  ${c.dim}${label}${c.reset}`);
}

/** Truncates a string to max length */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// ─── Box Drawing ────────────────────────────────────────────

/** Draws a box around content lines */
export function box(lines: string[], width = 44): string {
  const top = `  ${c.yellow}╭${"─".repeat(width)}╮${c.reset}`;
  const bot = `  ${c.yellow}╰${"─".repeat(width)}╯${c.reset}`;
  const rows = lines.map((l) => {
    // Strip ANSI for length calculation
    const stripped = l.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = width - 2 - stripped.length;
    return `  ${c.yellow}│${c.reset} ${l}${" ".repeat(Math.max(0, pad))} ${c.yellow}│${c.reset}`;
  });
  return [top, ...rows, bot].join("\n");
}

/** Draws a horizontal rule with optional label */
export function hr(width = 50, label?: string): string {
  if (!label) return `${c.dim}${"─".repeat(width)}${c.reset}`;
  const labelStr = ` ${label} `;
  const side = Math.max(0, Math.floor((width - labelStr.length) / 2));
  return `${c.dim}${"─".repeat(side)}${c.reset}${labelStr}${c.dim}${"─".repeat(width - side - labelStr.length)}${c.reset}`;
}

// ─── Spinner ────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Creates an animated spinner. Call .stop() when done. */
export function createSpinner(message: string): { stop: (finalMsg: string) => void; update: (msg: string) => void } {
  let i = 0;
  let currentMsg = message;
  stdout.write(c.hideCursor);

  const timer = setInterval(() => {
    const frame = SPINNER_FRAMES[i % SPINNER_FRAMES.length];
    stdout.write(`${c.clearLine}${ts()} ${c.yellow}${frame}${c.reset} ${currentMsg}`);
    i++;
  }, 80);

  return {
    update(msg: string) {
      currentMsg = msg;
    },
    stop(finalMsg: string) {
      clearInterval(timer);
      stdout.write(`${c.clearLine}${ts()} ${c.green}✓${c.reset} ${finalMsg}\n`);
      stdout.write(c.showCursor);
    },
  };
}

// ─── Score Bar ──────────────────────────────────────────────

/** Renders a colored score bar: ████░░░░░░ 4/10 */
export function scoreBar(score: number, max = 10): string {
  const width = 10;
  const filled = Math.round((score / max) * width);
  const empty = width - filled;
  const color = score >= 7 ? c.green : score >= 4 ? c.yellow : c.red;
  return `${color}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset} ${color}${c.bold}${score}${c.reset}${c.dim}/${max}${c.reset}`;
}

// ─── Animated Banner ────────────────────────────────────────

/** Prints the banner with line-by-line animation */
export async function animateBanner(lines: string[]): Promise<void> {
  stdout.write(c.hideCursor);
  for (const line of lines) {
    console.log(line);
    await sleep(30);
  }
  stdout.write(c.showCursor);
}

/** Simple delay helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Raw Key Reader ─────────────────────────────────────────

/** Reads a single keypress in raw mode. Returns the key string. */
export function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once("data", (data: Buffer) => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      const key = data.toString();
      // Handle Ctrl+C
      if (key === "\x03") {
        stdout.write(c.showCursor);
        process.exit(0);
      }
      resolve(key);
    });
  });
}
