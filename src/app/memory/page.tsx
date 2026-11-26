"use client";

import { useState } from "react";
import Link from "next/link";
import { clearLocalConversations } from "@/lib/chat-storage";

export default function MemoryPage() {
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function clearMemory() {
    if (!window.confirm("Delete local chat history and all cloud conversations for this signed-in account?")) return;
    setDeleting(true);
    setStatus("");
    try {
      const sessionResponse = await fetch("/api/session");
      const session = await sessionResponse.json();
      if (session.authenticated && session.databaseConfigured) {
        const response = await fetch("/api/conversations?all=true", { method: "DELETE" });
        if (!response.ok) throw new Error("Cloud memory could not be deleted.");
      }
      clearLocalConversations();
      setStatus("Saved conversation memory was deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Memory deletion failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-blue-400">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-bold">Memory Settings</h1>
        <section className="mt-8 rounded-2xl border border-white/8 bg-[#101d31] p-5">
          <h2 className="font-semibold">Conversation Memory</h2>
          <p className="mt-2 text-sm text-slate-400">Chats are saved in this browser. Sign in with GitHub and configure PostgreSQL to synchronize history to your account.</p>
          <button disabled={deleting} onClick={() => void clearMemory()} className="mt-5 rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-300 disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete saved memory"}
          </button>
          {status && <p role="status" className="mt-4 text-sm text-slate-300">{status}</p>}
        </section>
      </div>
    </main>
  );
}
