/** Model tier names used across all agents. Mapped to concrete Anthropic IDs in runner.ts. */
export type ModelTier = "haiku" | "sonnet" | "opus";

/** Definition of a single LLM-backed agent. */
export interface AgentRequest<I> {
  /** Stable identifier — used for telemetry and error messages. */
  name: string;
  /** Tier; concrete model ID resolved by runner. */
  model: ModelTier;
  /** System prompt. */
  system: string;
  /** Builds the user message from the agent's typed input. */
  user: (input: I) => string;
  /** Max output tokens. Defaults applied per tier in runner. */
  maxTokens?: number;
}

/** Telemetry collected from a single agent call. */
export interface AgentTelemetry {
  name: string;
  model: ModelTier;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

/** Combined output of a single agent run. */
export interface AgentRunResult<O> {
  output: O;
  telemetry: AgentTelemetry;
}
