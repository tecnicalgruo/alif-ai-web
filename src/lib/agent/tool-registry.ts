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

export function summarizeText(text: string): string {
  const sentences = text.trim().split(/(?<=[.!?।])\s+/).filter(Boolean);
  return sentences.slice(0, 3).join(" ") || text.trim().slice(0, 500);
}

export function calculateExpression(expression: string): number {
  if (expression.length > 300) throw new Error("Expression is too long");
  const tokens: string[] = [];
  let remainder = expression.trim();
  while (remainder.length) {
    const token = /^\s*(\d+(?:\.\d*)?|\.\d+|[()+\-*/%])/.exec(remainder);
    if (!token) throw new Error("Unsupported expression");
    tokens.push(token[1]);
    remainder = remainder.slice(token[0].length);
  }
  let position = 0;

  function parsePrimary(depth: number): number {
    if (depth > 30) throw new Error("Expression nesting is too deep");
    const token = tokens[position++];
    if (token === "(") {
      const value = parseSum(depth + 1);
      if (tokens[position++] !== ")") throw new Error("Unbalanced parentheses");
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error("Expected a number");
    }
    return Number(token);
  }

  function parseUnary(depth: number): number {
    const token = tokens[position];
    if (token === "+" || token === "-") {
      position += 1;
      const value = parseUnary(depth + 1);
      return token === "-" ? -value : value;
    }
    return parsePrimary(depth);
  }

  function parseProduct(depth: number): number {
    let value = parseUnary(depth);
    while (["*", "/", "%"].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = parseUnary(depth);
      if (operator === "*") value *= right;
      else if (operator === "/") value /= right;
      else value %= right;
    }
    return value;
  }

  function parseSum(depth: number): number {
    let value = parseProduct(depth);
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = parseProduct(depth);
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseSum(0);
  if (position !== tokens.length) throw new Error("Unexpected token in expression");
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("Invalid result");
  return result;
}
