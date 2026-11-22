"use client";

import { useState } from "react";
import Link from "next/link";

export default function MemoryPage() {
  const [status, setStatus] = useState("");
  function clearMemory() {
    localStorage.removeItem("alif-ai-history");
    setStatus("Local conversation memory cleared.");
  }
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">Memory Settings</h1>
        <section className="mt-8 rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="font-semibold">Local Memory</h2><p className="mt-2 text-sm text-slate-400">Chat history is kept in this browser until you clear it.</p><button onClick={clearMemory} className="mt-5 rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-300">Delete local memory</button>{status && <p className="mt-4 text-sm text-emerald-300">{status}</p>}</section>
      </div>
    </main>
  );
}
