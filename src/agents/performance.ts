import { buildSpecialistRequest, runSpecialist } from "./specialist.js";
import type { SpecialistInput } from "./specialist.js";
import type { AgentRunResult } from "./types.js";
import type { ReviewComment } from "../types.js";

const REQUEST = buildSpecialistRequest({
  name: "performance",
  model: "haiku",
  focus: `Node.js runtime performance — flag ONLY observable, demonstrated problems on hot paths:

- Synchronous I/O on the request path (fs.readFileSync, child_process.execSync, sync crypto).
- Real N+1 patterns (await inside a for-loop where Promise.all would be correct and is safe).
- Listener leaks: emitter.on() without matching off() in long-lived processes.
- Buffer allocations in tight loops where a stream or pre-allocated buffer would be obviously correct.
- Blocking the event loop with CPU-bound work (large JSON.parse, deep clones, regex on huge inputs) on a request handler.
- Memory growth without bound: unbounded caches, unbounded arrays.

Skip: micro-optimisations, "could use a Map", style-of-loop preferences, things only measurable with a benchmark, anything cosmetic.`,
});

export async function runPerformanceSpecialist(input: SpecialistInput): Promise<AgentRunResult<ReviewComment[]>> {
  return runSpecialist(REQUEST, input);
}
