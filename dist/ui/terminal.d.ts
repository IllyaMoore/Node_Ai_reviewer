/** ANSI color/style helpers */
export declare const c: {
    reset: string;
    bold: string;
    dim: string;
    italic: string;
    underline: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    bgCyan: string;
    bgMagenta: string;
    clearLine: string;
    clearScreen: string;
    hideCursor: string;
    showCursor: string;
};
/** Clears the terminal and moves cursor to top-left */
export declare function clear(): void;
/** Returns a formatted timestamp string */
export declare function ts(): string;
/** Logs a message with timestamp */
export declare function log(msg: string): void;
/** Logs an error with timestamp */
export declare function logError(msg: string): void;
/** Draws a progress bar with percentage */
export declare function progressBar(current: number, total: number, label: string): void;
/** Truncates a string to max length */
export declare function truncate(str: string, max: number): string;
/** Draws a box around content lines */
export declare function box(lines: string[], width?: number): string;
/** Draws a horizontal rule with optional label */
export declare function hr(width?: number, label?: string): string;
/** Creates an animated spinner. Call .stop() when done. Auto-cleans after 5 min. */
export declare function createSpinner(message: string): {
    stop: (finalMsg: string) => void;
    update: (msg: string) => void;
};
/** Renders a colored score bar: ████░░░░░░ 4/10 */
export declare function scoreBar(score: number, max?: number): string;
/** Prints the banner with line-by-line animation */
export declare function animateBanner(lines: string[]): Promise<void>;
/** Simple delay helper */
export declare function sleep(ms: number): Promise<void>;
/** Reads a single keypress in raw mode. Returns the key string. */
export declare function readKey(): Promise<string>;
//# sourceMappingURL=terminal.d.ts.map