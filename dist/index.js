#!/usr/bin/env node
import { loadEnv } from "./config.js";
loadEnv();
import { parseCLI, cliScanMode } from "./cli.js";
import { interactiveMode } from "./interactive.js";
import { runReview } from "./pipeline.js";
import { logError } from "./ui/terminal.js";
import { printBanner } from "./ui/display.js";
async function main() {
    printBanner();
    const mode = parseCLI();
    if (mode === "interactive") {
        await interactiveMode();
    }
    else if (mode === "scan") {
        await cliScanMode();
    }
    else {
        await runReview(mode);
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Fatal: ${message}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map