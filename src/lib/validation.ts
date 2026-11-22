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
