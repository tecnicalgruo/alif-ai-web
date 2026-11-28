import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(30000),
  })).min(1).max(100),
  provider: z.enum(["gemini", "grok", "openrouter"]).optional(),
  model: z.string().min(1).max(200).optional(),
  mode: z.enum(["assistant", "agent"]).optional(),
  language: z.enum(["en", "bn"]).default("en"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const conversationSaveSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(200),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(30000),
    model: z.string().max(200).optional(),
  })).min(1).max(100),
});

export const accountPreferencesSchema = z.object({
  preferredProvider: z.enum(["gemini", "grok", "openrouter"]),
  language: z.enum(["en", "bn"]),
  autoRead: z.boolean(),
});

export const pluginPreferenceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/),
  enabled: z.boolean(),
});

export const agentRequestSchema = z.object({
  objective: z.string().trim().min(3).max(5000),
  approvedTools: z.array(z.enum([
    "calculator",
    "web_search",
    "text_summarizer",
    "github_list_repositories",
    "github_search_issues",
    "github_create_issue",
    "supabase_read_rows",
    "supabase_insert_row",
    "supabase_update_rows",
    "gmail_search_messages",
    "gmail_read_message",
    "gmail_send_message",
  ])).max(12).default([]),
  language: z.enum(["en", "bn"]).default("en"),
});

export type { AccountPreferences } from "@/lib/account-preferences";
