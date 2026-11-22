import { NextResponse } from "next/server";

const plugins = [
  ["web-search", "Web Search", "Search public sources through Tavily"],
  ["calculator", "Calculator", "Evaluate approved arithmetic expressions"],
  ["pdf-reader", "PDF Reader", "Extract text from PDF files"],
  ["txt-reader", "TXT Reader", "Read plain text files"],
  ["docx-reader", "DOCX Reader", "Extract DOCX text"],
  ["code-assistant", "Code Assistant", "Provide programming assistance"],
  ["youtube-search", "YouTube Search", "Registered; provider not configured"],
  ["weather", "Weather", "Registered; provider not configured"],
  ["custom-api", "Custom API", "Registered; execution requires explicit configuration"],
  ["text-summarizer", "Text Summarizer", "Summarize provided text"],
  ["translation", "Translation", "Translate Bengali and English text"],
  ["image-analysis", "Image Analysis", "Registered; provider not configured"],
] as const;

export async function GET() {
  return NextResponse.json({
    plugins: plugins.map(([slug, name, description]) => ({ slug, name, description, enabled: slug === "calculator" || slug.endsWith("reader") || slug === "txt-reader" })),
  });
}
