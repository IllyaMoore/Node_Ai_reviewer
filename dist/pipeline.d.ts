import type { PRData, ReviewResult } from "./types.js";
/** Review pipeline configuration */
export interface ReviewConfig {
    owner: string;
    repo: string;
    prNumber: number;
    githubToken: string;
    dryRun: boolean;
}
/** Result returned from runReview for post-review actions */
export interface ReviewOutcome {
    result: ReviewResult;
    prData: PRData;
    comment: string;
    durationSec: number;
}
/** Runs the full review pipeline: fetch → review → format → post */
export declare function runReview(config: ReviewConfig, previousReview?: ReviewResult): Promise<ReviewOutcome | null>;
//# sourceMappingURL=pipeline.d.ts.map