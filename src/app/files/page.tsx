"use client";

import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";

type StoredFile = { id: string; name: string; size: number; createdAt: string; conversationId: string | null };
type ConversationOption = { id: string; title: string };

export default function FilesPage() {
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [canStore, setCanStore] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/session")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check account status.");
        return response.json();
      })
      .then(async (session) => {
        if (!active || !session.authenticated || !session.databaseConfigured) return;
        const [fileResponse, conversationResponse] = await Promise.all([
          fetch("/api/files"),
          fetch("/api/conversations"),
        ]);
        if (!fileResponse.ok || !conversationResponse.ok) throw new Error("Could not load saved files or conversations.");
        const [fileData, conversationData] = await Promise.all([fileResponse.json(), conversationResponse.json()]);
        if (!active) return;
        setCanStore(true);
        setFiles(fileData.files ?? []);
        setConversations((conversationData.conversations ?? []).map((item: ConversationOption) => ({ id: item.id, title: item.title })));
      })
      .catch((error: unknown) => {
        if (active) setStatus(error instanceof Error ? error.message : "Could not load account files.");
      });
    return () => { active = false; };
  }, []);

  async function refreshFiles() {
    const response = await fetch("/api/files");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not refresh saved files.");
    setFiles(data.files ?? []);
  }

  async function upload(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setStatus("File exceeds the 4 MB serverless request limit.");
      return;
    }
    setStatus("Extracting document...");
    setText("");
    const form = new FormData();
    form.set("file", file);
    if (conversationId) form.set("conversationId", conversationId);
    try {
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "File extraction failed.");
      setStatus(data.stored ? `${data.name} extracted, saved, and linked to your account.` : `${data.name} extracted for this session only. Sign in with a configured database to save files.`);
      setText(data.text);
      if (data.stored) await refreshFiles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "File extraction failed.");
    }
  }

  async function openFile(id: string) {
    try {
      const response = await fetch(`/api/files?id=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not open saved file.");
      setText(data.file.extractedText);
      setStatus(`${data.file.name} loaded from your account.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open saved file.");
    }
  }

  async function deleteFile(id: string) {
    if (!window.confirm("Delete this saved document from your account?")) return;
    try {
      const response = await fetch(`/api/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete saved file.");
      setFiles((current) => current.filter((file) => file.id !== id));
      setStatus("Saved document deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete saved file.");
    }
  }

  async function linkSavedFile(id: string) {
    if (!conversationId) return;
    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id, conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not link saved document.");
      setFiles((current) => current.map((file) => file.id === id ? { ...file, conversationId } : file));
      setStatus("Saved document linked to the selected conversation.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not link saved document.");
    }
  }
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">File Assistant</h1>
        <label className="mt-8 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#101d31]">
          <span className="text-4xl">＋</span><b className="mt-3">Upload PDF, TXT or DOCX</b>          <span className="mt-1 text-sm text-slate-400">Maximum 4 MB</span>
          <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
        </label>
        {canStore && <label className="mt-4 block text-sm text-slate-300">Link extracted text to a conversation (optional)
          <select value={conversationId} onChange={(event) => setConversationId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101d31] px-4 py-3">
            <option value="">No conversation</option>
            {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
          </select>
        </label>}
        {status && <p className="mt-4 rounded-xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-300">{status}</p>}
        {text && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-300">{text}</pre>}
        {canStore && <section className="mt-8"><h2 className="mb-3 text-xl font-semibold">Saved documents</h2>
          {files.length ? <div className="space-y-2">{files.map((file) => <article key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#101d31] p-4">
            <div className="min-w-0"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-slate-400">{Math.ceil(file.size / 1024)} KB{file.conversationId ? " · linked to a conversation" : ""}</p></div>
            <div className="flex shrink-0 gap-2"><button onClick={() => void openFile(file.id)} className="rounded-lg border border-white/10 px-3 py-2 text-sm">Open</button>{conversationId && conversationId !== file.conversationId && <button onClick={() => void linkSavedFile(file.id)} className="rounded-lg border border-violet-400/20 px-3 py-2 text-sm text-violet-300">Link</button>}<button onClick={() => void deleteFile(file.id)} className="rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-300">Delete</button></div>
          </article>)}</div> : <p className="text-sm text-slate-400">No saved documents yet.</p>}
        </section>}
      </div>
    </main>
  );
}
