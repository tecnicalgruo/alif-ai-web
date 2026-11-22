"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = { role: "user" | "assistant"; content: string };
type ProviderStatus = { id: string; name: string; model: string; configured: boolean };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((data) => setProviders(data.providers ?? []));
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text } as Message];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, provider }),
        signal: controller.current.signal,
      });
      if (!response.body) throw new Error("No response stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.error) throw new Error(event.error);
            if (event.text) setMessages((current) => {
              const copy = [...current];
              copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + event.text };
              return copy;
            });
          } catch (error) {
            if (error instanceof Error) setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: `Error: ${error.message}` }]);
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: `Error: ${(error as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="flex h-16 items-center justify-between border-b border-white/8 px-4 lg:px-8">
        <div className="flex items-center gap-3"><Link href="/" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 font-bold">A</Link><div><b>ALIF AI</b><p className="text-xs text-slate-400">AI Chat</p></div></div>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-white/10 bg-[#101d31] px-3 py-2 text-sm outline-none">
          {providers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.configured ? "" : " — not configured"}</option>)}
        </select>
      </header>
      <section className="mx-auto flex h-[calc(100vh-64px)] max-w-4xl flex-col px-4">
        <div className="flex-1 overflow-y-auto py-8">
          {messages.length === 0 && <div className="mx-auto mt-24 max-w-lg text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-bold">A</div><h1 className="text-2xl font-bold">How can I help you?</h1><p className="mt-2 text-sm text-slate-400">Ask in Bengali or English.</p></div>}
          {messages.map((message, index) => (
            <div key={index} className={`mb-5 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-blue-600" : "border border-white/8 bg-[#101d31]"}`}>
                {message.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : message.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="pb-5">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#101d31] p-2">
            <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message ALIF AI..." className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 outline-none" />
            {loading ? <button onClick={() => controller.current?.abort()} className="h-12 rounded-xl bg-red-500/20 px-4 text-red-300">Stop</button> : <button onClick={send} className="h-12 rounded-xl bg-blue-600 px-5 font-semibold hover:bg-blue-500">Send</button>}
          </div>
        </div>
      </section>
    </main>
  );
}
