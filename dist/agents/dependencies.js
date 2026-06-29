import { buildSpecialistRequest, runSpecialist } from "./specialist.js";
const REQUEST = buildSpecialistRequest({
    name: "dependencies",
    model: "haiku",
    focus: `Dependency hygiene around package.json / lockfiles — flag ONLY concrete problems:

- A newly added dependency duplicates functionality of a Node built-in already used in the repo (e.g. adding "node-fetch" alongside the global fetch).
- A package version was bumped across a known breaking-change boundary without an accompanying code change for the breakage.
- A peer dependency was added without the corresponding peerDependencies entry.
- A dependency was added in dependencies that should be in devDependencies (test-only, build-only) or vice-versa.
- An import statement references a package that is not declared in package.json (will fail npm ci).
- A removed dependency is still imported somewhere in the diff (will crash at runtime).

Skip: package version preferences, "consider switching to X", general taste about library choice.`,
});
export async function runDependenciesSpecialist(input) {
    return runSpecialist(REQUEST, input);
}
//# sourceMappingURL=dependencies.js.map