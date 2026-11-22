import { NextRequest } from "next/server";

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "A file is required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "File exceeds the 10 MB limit" }, { status: 413 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Only PDF, TXT, and DOCX files are allowed" }, { status: 415 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (file.type === "text/plain") {
    text = buffer.toString("utf8");
  } else if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const parsed = await parser.getText();
    text = parsed.text;
    await parser.destroy();
  } else {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer });
    text = parsed.value;
  }

  return Response.json({
    name: file.name,
    mimeType: file.type,
    size: file.size,
    text: text.slice(0, 100000),
  });
}
