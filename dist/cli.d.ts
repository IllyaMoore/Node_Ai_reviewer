import type { ReviewConfig } from "./pipeline.js";
/** Parses CLI arguments. Returns "interactive", "scan", or a ReviewConfig. */
export declare function parseCLI(): "interactive" | "scan" | ReviewConfig;
/** CLI scan mode: scan and display open PRs then exit */
export declare function cliScanMode(): Promise<void>;
//# sourceMappingURL=cli.d.ts.map