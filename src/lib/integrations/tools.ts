import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { searchGmail, readGmailMessage, sendGmailMessage } from "@/lib/integrations/gmail";
import { loadIntegration } from "@/lib/integrations/vault";

const fieldName = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/);
const scalar = z.union([
  z.string().max(2000).refine((value) => !/[(),]/.test(value), "Filter strings cannot contain commas or parentheses."),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const integrationToolSchemas = {
  github_list_repositories: z.object({}),
  github_search_issues: z.object({ query: z.string().trim().min(2).max(200) }),
  github_create_issue: z.object({
    repository: z.string()
      .regex(/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/)
      .refine((value) => value.split("/").every((part) => part !== "." && part !== "..")),
    title: z.string().trim().min(1).max(256),
    body: z.string().max(10_000),
  }),
  supabase_read_rows: z.object({
    table: fieldName,
    filters: z.array(z.object({ field: fieldName, value: scalar }))
      .max(4)
      .refine((filters) => new Set(filters.map(({ field }) => field)).size === filters.length)
      .default([]),
  }),
  supabase_insert_row: z.object({
    table: fieldName,
    values: z.record(fieldName, scalar).refine((value) => Object.keys(value).length > 0 && Object.keys(value).length <= 30),
  }),
  supabase_update_rows: z.object({
    table: fieldName,
    filters: z.array(z.object({ field: fieldName, value: scalar }))
      .min(1)
      .max(4)
      .refine((filters) => new Set(filters.map(({ field }) => field)).size === filters.length),
    values: z.record(fieldName, scalar).refine((value) => Object.keys(value).length > 0 && Object.keys(value).length <= 30),
  }),
  gmail_search_messages: z.object({ query: z.string().trim().min(1).max(500), maxResults: z.number().int().min(1).max(10).default(5) }),
  gmail_read_message: z.object({ messageId: z.string().min(1).max(200) }),
  gmail_send_message: z.object({
    recipient: z.string().email().max(254),
    subject: z.string().max(200),
    text: z.string().min(1).max(10_000),
  }),
} as const;

export type IntegrationToolName = keyof typeof integrationToolSchemas;

const githubErrorSchema = z.object({ message: z.string().optional() });

async function githubRequest(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.github.com/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => null);
    const error = githubErrorSchema.safeParse(raw);
    throw new Error(error.success && error.data.message
      ? `GitHub request failed (${response.status}): ${error.data.message.slice(0, 180)}`
      : `GitHub request failed (${response.status}).`);
  }
  return response;
}

function assertAllowedTable(table: string, allowedTables: string[]) {
  if (!allowedTables.includes(table)) throw new Error(`The Supabase table "${table}" is not on the connection allowlist.`);
}

function addFilters(url: URL, filters: Array<{ field: string; value: string | number | boolean | null }>) {
  for (const filter of filters) {
    const value = filter.value === null ? "is.null" : `eq.${String(filter.value)}`;
    url.searchParams.set(filter.field, value);
  }
}

export async function executeIntegrationTool(
  prisma: PrismaClient,
  userId: string,
  tool: IntegrationToolName,
  rawArguments: unknown,
) {
  const parsed = integrationToolSchemas[tool].safeParse(rawArguments);
  if (!parsed.success) throw new Error("The agent supplied invalid integration tool arguments.");

  if (tool.startsWith("github_")) {
    const integration = await loadIntegration(prisma, userId, "github");
    if (!integration) throw new Error("Connect GitHub before using its tools.");
    if (tool === "github_list_repositories") {
      const raw: unknown = await (await githubRequest(integration.accessToken, "user/repos?per_page=30&sort=updated")).json();
      const repositories = z.array(z.object({
        full_name: z.string(),
        private: z.boolean(),
        html_url: z.string().url(),
        description: z.string().nullable().optional(),
      })).safeParse(raw);
      if (!repositories.success) throw new Error("GitHub returned an invalid repository list.");
      return repositories.data.map(({ full_name, private: isPrivate, html_url, description }) => ({
        repository: full_name,
        private: isPrivate,
        url: html_url,
        description,
      }));
    }
    if (tool === "github_search_issues") {
      const args = parsed.data as z.infer<typeof integrationToolSchemas.github_search_issues>;
      const query = new URLSearchParams({ q: args.query, per_page: "10" });
      const raw: unknown = await (await githubRequest(integration.accessToken, `search/issues?${query}`)).json();
      const result = z.object({
        items: z.array(z.object({
          title: z.string(),
          html_url: z.string().url(),
          state: z.string(),
          repository_url: z.string().url(),
          number: z.number(),
        })),
      }).safeParse(raw);
      if (!result.success) throw new Error("GitHub returned invalid search results.");
      return result.data.items;
    }
    const args = parsed.data as z.infer<typeof integrationToolSchemas.github_create_issue>;
    const [owner, repository] = args.repository.split("/");
    const raw: unknown = await (await githubRequest(
      integration.accessToken,
      `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: args.title, body: args.body }),
      },
    )).json();
    const created = z.object({ number: z.number(), html_url: z.string().url(), title: z.string() }).safeParse(raw);
    if (!created.success) throw new Error("GitHub did not confirm the created issue.");
    return { issueNumber: created.data.number, url: created.data.html_url, title: created.data.title };
  }

  if (tool.startsWith("supabase_")) {
    const integration = await loadIntegration(prisma, userId, "supabase");
    if (!integration) throw new Error("Connect Supabase before using its tools.");
    const table = (parsed.data as { table: string }).table;
    assertAllowedTable(table, integration.allowedTables);
    const url = new URL(`/rest/v1/${encodeURIComponent(table)}`, integration.projectUrl);
    const headers = {
      apikey: integration.publishableKey,
      Authorization: `Bearer ${integration.publishableKey}`,
      "Content-Type": "application/json",
    };

    if (tool === "supabase_read_rows") {
      const args = parsed.data as z.infer<typeof integrationToolSchemas.supabase_read_rows>;
      url.searchParams.set("select", "*");
      url.searchParams.set("limit", "20");
      addFilters(url, args.filters);
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`Supabase read failed (${response.status}); check table access and Row Level Security.`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Supabase returned an invalid row list.");
      return rows;
    }
    if (tool === "supabase_insert_row") {
      const args = parsed.data as z.infer<typeof integrationToolSchemas.supabase_insert_row>;
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(args.values),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Supabase insert failed (${response.status}); check table access and Row Level Security.`);
      return response.json();
    }
    const args = parsed.data as z.infer<typeof integrationToolSchemas.supabase_update_rows>;
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", "1");
    addFilters(url, args.filters);
    const response = await fetch(url, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation,handling=strict,max-affected=1" },
      body: JSON.stringify(args.values),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Supabase update failed (${response.status}); check table access and Row Level Security.`);
    return response.json();
  }

  if (tool === "gmail_search_messages") {
    const args = parsed.data as z.infer<typeof integrationToolSchemas.gmail_search_messages>;
    return searchGmail(prisma, userId, args.query, args.maxResults);
  }
  if (tool === "gmail_read_message") {
    const args = parsed.data as z.infer<typeof integrationToolSchemas.gmail_read_message>;
    return readGmailMessage(prisma, userId, args.messageId);
  }
  const args = parsed.data as z.infer<typeof integrationToolSchemas.gmail_send_message>;
  return sendGmailMessage(prisma, userId, args.recipient, args.subject, args.text);
}
