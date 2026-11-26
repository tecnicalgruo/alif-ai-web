"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  readLocalConversations,
  saveLocalConversation,
  writeLocalConversations,
  type ConversationRecord,
} from "@/lib/chat-storage";

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [notice, setNotice] = useState("Loading chat history...");

  useEffect(() => {
    let active = true;
    let local: ConversationRecord[] = [];
    Promise.resolve().then(() => {
      try {
        local = readLocalConversations();
        if (active) {
          setConversations(local);
          setNotice(local.length ? "" : "No saved conversations yet.");
        }
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Could not read local history.");
      }
    });
    fetch("/api/session")
      .then(async (response) => {
        const session = await response.json();
        if (!session.authenticated || !session.databaseConfigured) return;
        const historyResponse = await fetch("/api/conversations");
        if (!historyResponse.ok) throw new Error("Could not load cloud history.");
        const data = await historyResponse.json();
        const cloudConversations = (data.conversations ?? []).map((item: {
          id: string;
          title: string;
          updatedAt: string;
          messages: Array<{ role: string; content: string; model?: string | null }>;
        }): ConversationRecord => ({
          id: item.id,
          title: item.title,
          updatedAt: item.updatedAt,
          messages: item.messages
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({
              role: message.role as "user" | "assistant",
              content: message.content,
              ...(message.model ? { model: message.model } : {}),
            })),
        }));
        const merged = [...cloudConversations, ...local]
          .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        for (const conversation of cloudConversations) saveLocalConversation(conversation);
        if (active) {
          setConversations(merged);
          setNotice(merged.length ? "" : "No saved conversations yet.");
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Cloud history is unavailable.");
      });

    return () => { active = false; };
  }, []);

  function removeLocal(id: string) {
    const updated = conversations.filter((conversation) => conversation.id !== id);
    writeLocalConversations(updated);
    setConversations(updated);
    fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then((response) => {
        if (!response.ok && response.status !== 401 && response.status !== 503) {
          setNotice("Removed from this browser, but could not delete cloud history.");
        }
      })
      .catch(() => setNotice("Removed from this browser; cloud history could not be reached."));
  }

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-blue-400">← Dashboard</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Chat History</h1>
          <Link href="/memory" className="rounded-lg border border-white/10 px-3 py-2 text-sm">Memory settings</Link>
        </div>
        {notice && <p role="status" className="mt-5 text-sm text-slate-400">{notice}</p>}
        <div className="mt-6 space-y-3">
          {conversations.map((conversation) => (
            <article key={conversation.id} className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{conversation.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">{new Date(conversation.updatedAt).toLocaleString()} · {conversation.messages.length} messages</p>
                  <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm text-slate-400">{conversation.messages.at(-1)?.content}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => { localStorage.setItem("alif-ai-active-conversation", conversation.id); router.push("/chat"); }} className="rounded-lg bg-blue-600 px-3 py-2 text-sm">Open</button>
                  <button onClick={() => removeLocal(conversation.id)} className="rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-300">Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
