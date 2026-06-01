import type { PRData } from "../types.js";

/** A Linear ticket as returned from the Linear GraphQL API. */
export interface LinearTicket {
  identifier: string;
  title: string;
  description: string | null;
  state: { name: string; type: string } | null;
  priority: number | null;
  labels: string[];
  parent: { identifier: string; title: string } | null;
  url: string | null;
}

const TICKET_ID_RX = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;
const TICKET_ID_RX_CI = /\b[a-z][a-z0-9]{1,9}-\d+\b/i;
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const FETCH_TIMEOUT_MS = 5000;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Extracts a Linear ticket identifier from PR metadata. Searches in priority:
 * 1. PR title  2. PR body  3. head branch name
 *
 * Returns null when no identifier is found anywhere.
 */
export function extractTicketId(prData: PRData): string | null {
  const titleMatch = TICKET_ID_RX.exec(prData.title);
  if (titleMatch) return titleMatch[0];

  if (prData.body) {
    const bodyMatch = TICKET_ID_RX.exec(prData.body);
    if (bodyMatch) return bodyMatch[0];
  }

  const branchMatch = TICKET_ID_RX_CI.exec(prData.headBranch);
  if (branchMatch) return branchMatch[0].toUpperCase();

  return null;
}

const TICKET_QUERY = `query Ticket($id: String!) {
  issue(id: $id) {
    identifier
    title
    description
    url
    priority
    state { name type }
    labels(first: 10) { nodes { name } }
    parent { identifier title }
  }
}`;

interface RawLinearResponse {
  data?: {
    issue: {
      identifier: string;
      title: string;
      description: string | null;
      url: string | null;
      priority: number | null;
      state: { name: string; type: string } | null;
      labels: { nodes: Array<{ name: string }> };
      parent: { identifier: string; title: string } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Fetches a single Linear ticket by identifier (e.g. "INT-53"). Best-effort: any
 * network/auth/parse failure or 404 returns null. Network call is bounded by a
 * short timeout so a slow Linear cannot stall the review pipeline.
 */
export async function fetchLinearTicket(
  id: string,
  apiKey: string
): Promise<LinearTicket | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query: TICKET_QUERY, variables: { id } }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as RawLinearResponse;
    const issue = payload.data?.issue;
    if (!issue) return null;

    return {
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      state: issue.state,
      priority: issue.priority,
      labels: issue.labels.nodes.map((n) => n.name),
      parent: issue.parent,
      url: issue.url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "no priority",
  1: "urgent",
  2: "high",
  3: "medium",
  4: "low",
};

function truncateDescription(description: string | null): string {
  if (!description) return "_(no description)_";
  const trimmed = description.trim();
  if (trimmed.length === 0) return "_(no description)_";
  if (trimmed.length <= MAX_DESCRIPTION_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_DESCRIPTION_LENGTH)}\n\n... [DESCRIPTION TRUNCATED — original was ${trimmed.length.toLocaleString()} characters] ...`;
}

/** Builds a markdown block describing the ticket for injection into agent prompts. */
export function formatLinearTicketContext(ticket: LinearTicket): string {
  const lines: string[] = [];
  lines.push(`**${ticket.identifier}** — ${ticket.title}`);
  if (ticket.url) lines.push(`URL: ${ticket.url}`);
  if (ticket.state) lines.push(`State: ${ticket.state.name} (${ticket.state.type})`);
  if (ticket.priority !== null && ticket.priority !== undefined) {
    const label = PRIORITY_LABELS[ticket.priority] ?? `priority ${ticket.priority}`;
    lines.push(`Priority: ${label}`);
  }
  if (ticket.labels.length > 0) {
    lines.push(`Labels: ${ticket.labels.join(", ")}`);
  }
  if (ticket.parent) {
    lines.push(`Parent: ${ticket.parent.identifier} — ${ticket.parent.title}`);
  }
  lines.push("");
  lines.push("Description:");
  lines.push(truncateDescription(ticket.description));
  lines.push("");
  lines.push(
    "This is the ticket the PR is supposed to implement. Use it to assess whether the diff accomplishes the stated goal. If the diff matches the ticket scope, that is a strong signal to APPROVE. A clear divergence from the ticket is a legitimate basis for NEEDS_DISCUSSION — but absence of every nice-to-have from the ticket description is not."
  );
  return lines.join("\n");
}
