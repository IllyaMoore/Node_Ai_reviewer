import { createInterface } from "node:readline/promises";
/** Readline interface type */
export type RL = ReturnType<typeof createInterface>;
/** Prompts for text input */
export declare function ask(rl: RL, label: string, defaultVal?: string): Promise<string>;
/** Prompts for yes/no */
export declare function confirm(rl: RL, label: string, defaultYes?: boolean): Promise<boolean>;
/** Prompts to pick a number from a list */
export declare function pickNumber(rl: RL, label: string, max: number): Promise<number>;
//# sourceMappingURL=prompts.d.ts.map