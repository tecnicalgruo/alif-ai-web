import { describe, expect, it } from "vitest";
import { calculateExpression, summarizeText, toolRegistry } from "./tool-registry";

describe("tool registry", () => {
  it("contains the initial safe tools", () => {
    expect(toolRegistry.map((tool) => tool.name)).toEqual([
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
    ]);
    expect(toolRegistry.find((tool) => tool.name === "supabase_update_rows")?.permissions).toBe("external");
  });

  it("evaluates approved arithmetic expressions", () => {
    expect(calculateExpression("125 * 8 + 20")).toBe(1020);
    expect(calculateExpression("-(3 + 5) * 2")).toBe(-16);
  });

  it("rejects arbitrary code", () => {
    expect(() => calculateExpression("process.exit()")).toThrow("Unsupported expression");
    expect(() => calculateExpression("1 / 0")).toThrow("Invalid result");
    expect(() => calculateExpression("1 2")).toThrow("Unexpected token in expression");
  });

  it("summarizes only the first three sentences of supplied text", () => {
    expect(summarizeText("One. Two. Three. Four.")).toBe("One. Two. Three.");
  });
});
