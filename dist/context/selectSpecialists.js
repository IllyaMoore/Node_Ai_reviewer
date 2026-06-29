const SECURITY_FILENAME_HINTS = /(auth|login|password|token|secret|credential|jwt|crypto|session|oauth)/i;
const SECURITY_DIFF_HINTS = /(\bexec\s*\(|child_process|require\s*\(\s*['"]child_process|spawn\s*\(|\beval\s*\(|new Function\s*\(|\bvm\.|fs\.readFileSync\s*\(\s*[a-z_]+\b|res\.redirect\s*\(\s*[a-z_]|fetch\s*\(\s*[a-z_]+\b|Object\.assign\s*\(\s*\{\s*\}\s*,\s*[a-z_]+\b)/i;
const HOTPATH_FILENAME_HINTS = /(handler|controller|route|server|api|stream|worker|queue|cron|job)/i;
const HOTPATH_DIFF_HINTS = /(for\s*\([^)]*await|fs\.[a-z]+Sync\s*\(|\.execSync\s*\(|\.on\s*\(['"]|JSON\.parse\s*\([^)]{200,})/;
const TEST_FILENAME_RX = /(\.test\.[tj]sx?$|\.spec\.[tj]sx?$|^tests?\/|__tests__|\/tests?\/)/i;
const DEPS_FILES = new Set([
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb",
]);
function anyFile(prData, predicate) {
    return prData.files.some((f) => predicate(f.filename));
}
function diffMatches(prData, rx) {
    return rx.test(prData.diff);
}
/**
 * Decides which focused specialists to run alongside the always-on correctness
 * agent. Pure heuristic — biased toward selection (false positives on selection
 * are cheap, missed specialist runs are not).
 */
export function selectSpecialists(prData) {
    const out = [];
    if (anyFile(prData, (f) => SECURITY_FILENAME_HINTS.test(f)) || diffMatches(prData, SECURITY_DIFF_HINTS)) {
        out.push("security");
    }
    if (anyFile(prData, (f) => HOTPATH_FILENAME_HINTS.test(f)) || diffMatches(prData, HOTPATH_DIFF_HINTS)) {
        out.push("performance");
    }
    if (anyFile(prData, (f) => TEST_FILENAME_RX.test(f))) {
        out.push("tests");
    }
    if (anyFile(prData, (f) => DEPS_FILES.has(f) || f.endsWith("/package.json"))) {
        out.push("dependencies");
    }
    return out;
}
//# sourceMappingURL=selectSpecialists.js.map