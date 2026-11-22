"use client";

import { useState } from "react";
import Link from "next/link";

export default function FilesPage() {
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus("File exceeds the 10 MB limit.");
      return;
    }
    setStatus("Extracting document...");
    setText("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/files", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? "File extraction failed.");
      return;
    }
    setStatus(`${data.name} extracted successfully.`);
    setText(data.text);
  }
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">File Assistant</h1>
        <label className="mt-8 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#101d31]">
          <span className="text-4xl">＋</span><b className="mt-3">Upload PDF, TXT or DOCX</b><span className="mt-1 text-sm text-slate-400">Maximum 10 MB</span>
          <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
        </label>
        {status && <p className="mt-4 rounded-xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-300">{status}</p>}
        {text && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-300">{text}</pre>}
      </div>
    </main>
  );
}
