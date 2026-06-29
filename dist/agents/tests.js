import { buildSpecialistRequest, runSpecialist } from "./specialist.js";
const REQUEST = buildSpecialistRequest({
    name: "tests",
    model: "haiku",
    focus: `Test quality — flag ONLY concrete gaps and broken tests, never coverage-style nags:

- A new public function or branch added in the diff has no test asserting its behaviour.
- A test asserts on an implementation detail (private method, internal state) instead of behaviour.
- A test mocks the system under test, making the assertion meaningless.
- A test contains a real-time/race condition (setTimeout-based assertion, no awaits) likely to flake.
- A test was deleted alongside the code it covered, leaving a regression-prone change.
- A test catches and swallows the failure it was meant to assert.

Skip: "consider adding a test for X", "could improve coverage", style-of-test preferences, naming.`,
});
export async function runTestsSpecialist(input) {
    return runSpecialist(REQUEST, input);
}
//# sourceMappingURL=tests.js.map