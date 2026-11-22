"use client";

import { useState } from "react";
import Link from "next/link";

type StoredMessage = { role: "user" | "assistant"; content: string };

export default function HistoryPage() {
  const [messages, setMessages] = useState<StoredMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("alif-ai-history") ?? "[]") as StoredMessage[]; } catch { return []; }
  });
  function clearHistory() {
    localStorage.removeItem("alif-ai-history");
    setMessages([]);
  }
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><div className="mt-2 flex items-center justify-between"><h1 className="text-3xl font-bold">Chat History</h1><button onClick={clearHistory} className="rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-300">Clear local history</button></div>
        <div className="mt-8 space-y-3">{messages.length === 0 ? <p className="rounded-2xl border border-white/8 bg-[#101d31] p-5 text-slate-400">No saved local chat history.</p> : messages.map((message, index) => <article key={index} className="rounded-2xl border border-white/8 bg-[#101d31] p-4"><b className="text-xs text-blue-300">{message.role}</b><p className="mt-2 whitespace-pre-wrap text-sm">{message.content}</p></article>)}</div>
      </div>
    </main>
  );
}
