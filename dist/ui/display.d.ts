import type { OpenPR } from "../github.js";
export interface HistoryEntry {
    repo: string;
    pr: number;
    title: string;
    verdict: string;
    score: number;
    time: string;
    duration: number;
}
/** Adds a review to session history */
export declare function addToHistory(entry: HistoryEntry): void;
/** Returns the session review history */
export declare function getHistory(): HistoryEntry[];
/** Prints the compact header bar */
export declare function printBanner(): void;
/** Main screen: header + status + menu. One unified layout. */
export declare function printMainScreen(opts: {
    username: string;
    prCount: number;
}): void;
export declare function printHelp(): void;
export declare function displayPRTable(prs: OpenPR[]): void;
export declare function printSummary(verdict: string, score: number, blocking: number, nonBlocking: number, praise: number, durationSec?: number): void;
export declare function displayHistory(): void;
//# sourceMappingURL=display.d.ts.map