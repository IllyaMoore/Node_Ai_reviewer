import type { PRData } from "../types.js";
export type SpecialistName = "security" | "performance" | "tests" | "dependencies";
/**
 * Decides which focused specialists to run alongside the always-on correctness
 * agent. Pure heuristic — biased toward selection (false positives on selection
 * are cheap, missed specialist runs are not).
 */
export declare function selectSpecialists(prData: PRData): SpecialistName[];
//# sourceMappingURL=selectSpecialists.d.ts.map