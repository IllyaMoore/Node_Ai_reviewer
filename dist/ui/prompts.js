import { c } from "./terminal.js";
/** Prompts for text input */
export async function ask(rl, label, defaultVal) {
    const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : "";
    const answer = await rl.question(`  ${c.yellow}❯${c.reset} ${label}${suffix}: `);
    return answer.trim() || defaultVal || "";
}
/** Prompts for yes/no */
export async function confirm(rl, label, defaultYes = true) {
    const hint = defaultYes ? "Y/n" : "y/N";
    const answer = await rl.question(`  ${c.yellow}❯${c.reset} ${label} ${c.dim}(${hint})${c.reset}: `);
    const val = answer.trim().toLowerCase();
    if (!val)
        return defaultYes;
    return val === "y" || val === "yes";
}
/** Prompts to pick a number from a list */
export async function pickNumber(rl, label, max) {
    const answer = await rl.question(`  ${c.yellow}❯${c.reset} ${label} ${c.dim}(1-${max})${c.reset}: `);
    const n = parseInt(answer.trim(), 10);
    if (isNaN(n) || n < 1 || n > max)
        return -1;
    return n;
}
//# sourceMappingURL=prompts.js.map