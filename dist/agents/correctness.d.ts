import type { PRData, ReviewResult } from "../types.js";
import type { AgentRunResult } from "./types.js";
export interface CorrectnessInput {
    prData: PRData;
    previous?: ReviewResult;
    /** Concatenated CLAUDE.md content from root + touched directories, if available. */
    projectRules?: string;
}
/** Runs the broad-spectrum correctness reviewer and returns a ReviewResult. */
export declare function runCorrectnessAgent(input: CorrectnessInput): Promise<AgentRunResult<ReviewResult>>;
//# sourceMappingURL=correctness.d.ts.map