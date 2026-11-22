export type ToolDefinition = {
  name: string;
  description: string;
  permissions: "none" | "external" | "destructive";
};

export const toolRegistry: ToolDefinition[] = [
  { name: "calculator", description: "Evaluate an arithmetic expression", permissions: "none" },
  { name: "web_search", description: "Search public web sources", permissions: "external" },
  { name: "text_summarizer", description: "Summarize provided text", permissions: "none" },
];

export function calculateExpression(expression: string): number {
  if (!/^[0-9+\-*/().%\s]+$/.test(expression)) throw new Error("Unsupported expression");
  const result = Function(`"use strict"; return (${expression})`)();
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("Invalid result");
  return result;
}
