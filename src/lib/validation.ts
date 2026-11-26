import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(30000),
  })).min(1).max(100),
  provider: z.enum(["gemini", "grok", "openrouter"]).optional(),
  model: z.string().min(1).max(200).optional(),
  mode: z.enum(["assistant", "agent"]).optional(),
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
