import { NextRequest } from "next/server";
import { z } from "zod";
import { calculateExpression, toolRegistry } from "@/lib/agent/tool-registry";

const schema = z.object({
  objective: z.string().min(3).max(5000),
  approvedTools: z.array(z.enum(["calculator", "web_search", "text_summarizer"])).max(10).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid agent objective", details: parsed.error.flatten() }, { status: 400 });

  const approved = new Set(parsed.data.approvedTools ?? []);
  const plan = [
    "Understand the objective",
    "Choose the minimum required tools",
    "Execute approved operations",
    "Verify results",
    "Produce a final report",
  ];
  const executionLogs: { tool: string; status: string; result: string }[] = [];

  if (approved.has("calculator")) {
    const match = parsed.data.objective.match(/-?\d+(?:\.\d+)?(?:\s*[+\-*/%]\s*-?\d+(?:\.\d+)?)+/);
    if (match) {
      try {
        executionLogs.push({ tool: "calculator", status: "completed", result: String(calculateExpression(match[0])) });
      } catch (error) {
        executionLogs.push({ tool: "calculator", status: "failed", result: error instanceof Error ? error.message : "Calculation failed" });
      }
    }
  }
  if (approved.has("web_search") && process.env.WEB_SEARCH_API_KEY) {
    executionLogs.push({ tool: "web_search", status: "blocked", result: "Configure a search provider implementation before execution." });
  }

  return Response.json({
    status: "completed",
    plan,
    availableTools: toolRegistry,
    approvedTools: [...approved],
    executionLogs,
    finalReport: "The agent produced a bounded local execution plan. External actions only run when explicitly approved and configured.",
  });
}
