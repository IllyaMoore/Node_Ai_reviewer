# PR Review Bot

Multi-agent code-review bot for GitHub pull requests, powered by the Anthropic API. Runs on every PR via GitHub Actions and posts inline review comments plus a top-level summary.

## Setup

```bash
npm install
cp .env.example .env  # ANTHROPIC_API_KEY + GITHUB_TOKEN
```

## Usage

```bash
npx tsx src/index.ts                              # interactive
npx tsx src/index.ts --repo=owner/repo --pr=123   # review one PR
npx tsx src/index.ts --scan                       # list open PRs
npx tsx src/index.ts --help
```

For a global CLI:

```bash
npm run build && npm link
pr-review
```

## GitHub Action

The bot is invoked from [.github/workflows/pr-review.yml](.github/workflows/pr-review.yml) on `pull_request: [opened, synchronize]`. Required repository secrets:

- `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN` (provided automatically by Actions)

When the Anthropic API is unreachable (low credit balance, auth failure, rate limit), the bot returns a fallback **APPROVE** instead of failing the workflow — a human reviewer can still take over.

## Architecture

The review is a multi-stage pipeline orchestrated in Node.js. Each stage is a separate Anthropic API call with its own focused system prompt and model tier; the orchestrator runs them in parallel where possible and merges the results.

```
                    ┌─────────────────┐
                    │   Orchestrator  │  src/orchestrator.ts
                    └────────┬────────┘
                             │
   ┌─────────────────────────┼─────────────────────────┐
   │                         │                         │
┌──▼──────────┐    ┌─────────▼─────────┐    ┌──────────▼──────────┐
│ 0. Preflight│───▶│ 1. Context enrich │───▶│ 2. Detect (parallel)│
│ heuristic   │    │ CLAUDE.md fetch   │    │ correctness +       │
│ skip docs/  │    │ from changed dirs │    │ selected specialists│
│ lockfiles   │    │                   │    │                     │
└──────────────┘    └───────────────────┘    └──────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │ 3. Validate (par.)  │
                                              │ 1 Haiku call per    │
                                              │ candidate finding   │
                                              └──────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │ 4. Aggregate        │
                                              │ dedupe + rank +     │
                                              │ recompute verdict   │
                                              └──────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │ 5. Post             │
                                              │ inline comments +   │
                                              │ top-level summary   │
                                              └─────────────────────┘
```

### Stage 0 — Preflight gate

A pure heuristic in [src/preflight.ts](src/preflight.ts) decides whether the PR is worth running the model pipeline on. Auto-approves docs-only PRs, lockfile-only updates, and empty diffs. No API call. If the gate auto-approves, the rest of the pipeline is skipped.

### Stage 1 — Context enrichment

[src/context/fetchClaudeMd.ts](src/context/fetchClaudeMd.ts) fetches `CLAUDE.md` from the repository root and from each directory containing a changed file. Found content is concatenated and injected into every reviewer's prompt as **PROJECT RULES** so flagged violations can quote the exact rule. Best-effort — missing files are silently skipped.

### Stage 2 — Detect

Two kinds of agents run in parallel:

| Agent | Model | When | Source |
|---|---|---|---|
| `correctness` | Sonnet | Always | [src/agents/correctness.ts](src/agents/correctness.ts) |
| `security` | Sonnet | Filenames / diff hint at auth, crypto, exec, eval, fetch with dynamic input | [src/agents/security.ts](src/agents/security.ts) |
| `performance` | Haiku | Filenames / diff hint at hot paths, sync I/O, large parses | [src/agents/performance.ts](src/agents/performance.ts) |
| `tests` | Haiku | Test files in the diff | [src/agents/tests.ts](src/agents/tests.ts) |
| `dependencies` | Haiku | `package.json` / lockfile in the diff | [src/agents/dependencies.ts](src/agents/dependencies.ts) |

Specialist selection is a pure heuristic in [src/context/selectSpecialists.ts](src/context/selectSpecialists.ts) — biased toward over-selection because Haiku calls are cheap and missed specialists are not.

Every agent shares the same **high-signal rubric**: only flag concrete bugs with a demonstrated wrong-result or attack path. Style, naming, formatting, and "could be improved" suggestions are explicitly excluded. False positives are treated as more harmful than missed nits.

### Stage 3 — Validate

Each candidate finding from Stage 2 is independently re-checked by a Haiku validator ([src/agents/validator.ts](src/agents/validator.ts)). The validator gets the file's patch and the candidate finding and replies `{ confirmed, reason }`. Unconfirmed findings are dropped.

Validator calls run in parallel (`Promise.all`) — N findings → N concurrent calls.

### Stage 4 — Aggregate

[src/aggregate.ts](src/aggregate.ts) deduplicates findings across agents (`file:line:category` keying, strongest severity wins), splits into `blocking` / `non_blocking`, and re-computes the verdict from the confirmed set:

- `blocking.length > 0` → **REQUEST_CHANGES**
- `questions.length > 0` → **NEEDS_DISCUSSION**
- otherwise → **APPROVE**

### Stage 5 — Post

[src/github.ts](src/github.ts) posts a single GitHub review (`octokit.pulls.createReview`) containing:

- A short top-level **summary** body (verdict, score, counts, praise, questions).
- Per-finding **inline comments** anchored to file + line, filtered against the diff so GitHub's API doesn't reject them.

Findings whose line isn't in the diff fall back to the summary body so nothing is dropped silently. On HTTP 422 (typically reviewing your own PR) the post is retried as a `COMMENT` event.

## Resilience

- **Preflight gate** short-circuits trivial PRs without any model cost.
- **APIError fallback** ([src/orchestrator.ts](src/orchestrator.ts)) — any Anthropic-side error returns an APPROVE with an explanation in the summary, so the GitHub Action never fails the pipeline.
- **Validator pass** removes most false positives before they reach the PR.
- **CI-safe interactive prompts** — post-review menu in [src/pipeline.ts](src/pipeline.ts) is skipped automatically when stdin is not a TTY.

## File map

```
src/
  agents/
    types.ts              Agent<I,O> contract + telemetry shape
    runner.ts             Anthropic call wrapper, JSON parsing, model tiers
    correctness.ts        Broad-spectrum reviewer (Sonnet, always on)
    specialist.ts         Shared helper for focused specialists
    security.ts           Security specialist (Sonnet)
    performance.ts        Performance specialist (Haiku)
    tests.ts              Test-quality specialist (Haiku)
    dependencies.ts       Dependency-hygiene specialist (Haiku)
    validator.ts          Per-finding validator (Haiku)
  context/
    fetchClaudeMd.ts      CLAUDE.md ingestion via GitHub Contents API
    selectSpecialists.ts  Heuristic specialist selection
  ui/                     Terminal helpers (banner, spinner, key reader, etc.)
  preflight.ts            Heuristic gate
  orchestrator.ts         Top-level multi-agent pipeline
  aggregate.ts            Dedupe / rank / split helpers
  github.ts               Octokit wrappers, inline-comment posting
  pipeline.ts             UX layer: spinners, telemetry, dry-run, history
  formatter.ts            Markdown formatters (top-level + inline + terminal)
  review.ts               Thin facade over orchestrate()
  types.ts                Zod schemas: ReviewComment, ReviewResult
  cli.ts, interactive.ts, config.ts, index.ts
```

## Cost notes

A typical PR with code changes runs:

- 1× correctness (Sonnet)
- 0–4× specialists (Haiku, mostly)
- N× validators (Haiku, one per candidate finding)

Total ≈ 2–3× a single-shot review, with the validator pass paying for itself by silencing false positives before they reach the PR. Trivial PRs cost zero (preflight gate).
