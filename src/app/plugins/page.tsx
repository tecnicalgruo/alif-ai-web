"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Plugin = { slug: string; name: string; description: string; enabled: boolean };

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  useEffect(() => {
    fetch("/api/plugins").then((response) => response.json()).then((data) => setPlugins(data.plugins ?? []));
  }, []);
  async function search() {
    setSearchResult("Searching...");
    const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, maxResults: 5 }) });
    const data = await response.json();
    setSearchResult(response.ok ? JSON.stringify(data, null, 2) : data.error ?? "Search failed");
  }
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">Plugin Marketplace</h1><p className="mt-2 text-slate-400">Safe, registered tools for ALIF AI.</p>
        <div className="mt-8 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the web..." className="flex-1 rounded-xl border border-white/10 bg-[#101d31] px-4 py-3 outline-none" /><button onClick={search} disabled={!query.trim()} className="rounded-xl bg-blue-600 px-5 font-semibold disabled:opacity-50">Search</button></div>
        {searchResult && <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-300">{searchResult}</pre>}
        <div className="mt-8 grid gap-4 md:grid-cols-3">{plugins.map((plugin, index) => <article key={plugin.slug} className="rounded-2xl border border-white/8 bg-[#101d31] p-5"><div className="mb-5 flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{index + 1}</div><span className={`text-xs ${plugin.enabled ? "text-emerald-300" : "text-slate-500"}`}>{plugin.enabled ? "Enabled" : "Registered"}</span></div><h2 className="font-semibold">{plugin.name}</h2><p className="mt-2 text-sm text-slate-400">{plugin.description}</p></article>)}</div>
      </div>
    </main>
  );
}
