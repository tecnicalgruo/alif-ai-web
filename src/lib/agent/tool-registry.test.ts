import { describe, expect, it } from "vitest";
import { calculateExpression, toolRegistry } from "./tool-registry";

describe("tool registry", () => {
  it("contains the initial safe tools", () => {
    expect(toolRegistry.map((tool) => tool.name)).toEqual(["calculator", "web_search", "text_summarizer"]);
  });

  it("evaluates approved arithmetic expressions", () => {
    expect(calculateExpression("125 * 8 + 20")).toBe(1020);
  });

  it("rejects arbitrary code", () => {
    expect(() => calculateExpression("process.exit()")).toThrow("Unsupported expression");
  });
});
