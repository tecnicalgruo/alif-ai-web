"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Plugin = {
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  configured: boolean;
};

type SearchResult = { title: string; url: string; content?: string };

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchAnswer, setSearchAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [preferencesSynced, setPreferencesSynced] = useState(false);

  useEffect(() => {
    fetch("/api/plugins")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load plugin list.");
        const data = await response.json();
        const saved = data.synced ? null : localStorage.getItem("alif-ai-plugin-preferences");
        const localSettings = saved ? JSON.parse(saved) as Record<string, boolean> : {};
        setPreferencesSynced(Boolean(data.synced));
        setPlugins((data.plugins ?? []).map((plugin: Plugin) => ({
          ...plugin,
          enabled: data.synced ? plugin.enabled : localSettings[plugin.slug] ?? plugin.enabled,
        })));
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Plugin list is unavailable."));
  }, []);

  async function togglePlugin(slug: string) {
    const plugin = plugins.find((item) => item.slug === slug);
    if (!plugin) return;
    const enabled = !plugin.enabled;
    setPlugins((current) => current.map((item) => item.slug === slug ? { ...item, enabled } : item));

    try {
      if (preferencesSynced) {
        const response = await fetch("/api/plugins", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, enabled }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not save plugin preference.");
      } else {
        const settings = Object.fromEntries(plugins.map((item) => [item.slug, item.slug === slug ? enabled : item.enabled]));
        localStorage.setItem("alif-ai-plugin-preferences", JSON.stringify(settings));
      }
      setNotice(preferencesSynced ? "Plugin preference saved to your account." : "Plugin preference saved in this browser.");
    } catch (error) {
      setPlugins((current) => current.map((item) => item.slug === slug ? { ...item, enabled: plugin.enabled } : item));
      setNotice(error instanceof Error ? error.message : "Could not save plugin preference.");
    }
  }

  async function search() {
    if (query.trim().length < 2 || searching) return;
    setSearching(true);
    setNotice("");
    setSearchResults([]);
    setSearchAnswer("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), maxResults: 5 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      setSearchResults(data.results ?? []);
      setSearchAnswer(data.answer ?? "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-blue-400">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-bold">Plugin Marketplace</h1>
        <p className="mt-2 text-slate-400">Enable or disable tools for your workspace. Account settings sync after sign-in with PostgreSQL configured.</p>
        <div className="mt-8 flex gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Search the web..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#101d31] px-4 py-3 outline-none" />
          <button onClick={() => void search()} disabled={searching || query.trim().length < 2} className="rounded-xl bg-blue-600 px-5 font-semibold disabled:opacity-50">{searching ? "Searching..." : "Search"}</button>
        </div>
        {notice && <p role="status" className="mt-4 rounded-xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-300">{notice}</p>}
        {searchAnswer && <p className="mt-4 rounded-xl border border-white/8 bg-[#101d31] p-4 text-sm text-slate-200">{searchAnswer}</p>}
        {searchResults.length > 0 && <div className="mt-4 space-y-3">{searchResults.map((result) => <article key={result.url} className="rounded-xl border border-white/8 bg-[#101d31] p-4"><a href={result.url} target="_blank" rel="noreferrer" className="font-medium text-blue-300 hover:underline">{result.title}</a><p className="mt-2 text-sm text-slate-400">{result.content}</p></article>)}</div>}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plugins.map((plugin) => (
            <article key={plugin.slug} className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-lg bg-violet-500/15 px-3 py-2 text-xs text-violet-300">{plugin.slug}</span>
                <span className={`text-xs ${plugin.enabled && plugin.configured ? "text-emerald-300" : "text-amber-300"}`}>
                  {plugin.enabled && plugin.configured ? "Ready" : plugin.enabled ? "Needs configuration" : "Disabled"}
                </span>
              </div>
              <h2 className="font-semibold">{plugin.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{plugin.description}</p>
              <button onClick={() => void togglePlugin(plugin.slug)} aria-pressed={plugin.enabled} className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${plugin.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-slate-300"}`}>{plugin.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}</button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
