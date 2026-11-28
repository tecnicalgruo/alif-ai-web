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
type Integration = {
  id: "github" | "supabase" | "gmail" | "remote-desktop-commander";
  name: string;
  configured: boolean;
  connected: boolean;
  account: string | null;
  allowedTables?: string[];
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [query, setQuery] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [supabaseTables, setSupabaseTables] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchAnswer, setSearchAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [preferencesSynced, setPreferencesSynced] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const gmailCallbackStatus = params.get("integration") === "gmail" ? params.get("status") : null;
    fetch("/api/plugins")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load plugin list.");
        const data = await response.json();
        const saved = data.synced ? null : localStorage.getItem("alif-ai-plugin-preferences");
        const localSettings = saved ? JSON.parse(saved) as Record<string, boolean> : {};
        if (!active) return;
        setPreferencesSynced(Boolean(data.synced));
        setPlugins((data.plugins ?? []).map((plugin: Plugin) => ({
          ...plugin,
          enabled: data.synced ? plugin.enabled : localSettings[plugin.slug] ?? plugin.enabled,
        })));
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Plugin list is unavailable.");
      });
    fetch("/api/integrations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Sign in to manage integrations.");
        if (active) {
          setIntegrations(data.integrations ?? []);
          if (gmailCallbackStatus) {
            setNotice(gmailCallbackStatus === "connected" ? "Gmail connected successfully." : "Gmail connection did not complete.");
          }
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Sign in to manage integrations.");
      });
    if (gmailCallbackStatus) window.history.replaceState(null, "", window.location.pathname);
    return () => { active = false; };
  }, []);

  async function refreshIntegrations() {
    const response = await fetch("/api/integrations", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load integration status.");
    setIntegrations(data.integrations ?? []);
  }

  async function connectIntegration(provider: "github" | "supabase") {
    setSavingIntegration(true);
    setNotice("");
    try {
      const body = provider === "github"
        ? { provider, token: githubToken }
        : {
            provider,
            projectUrl: supabaseUrl,
            publishableKey: supabaseKey,
            allowedTables: supabaseTables.split(",").map((table) => table.trim()).filter(Boolean),
          };
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Could not connect ${provider}.`);
      setGithubToken("");
      setSupabaseKey("");
      await refreshIntegrations();
      setNotice(`${provider === "github" ? "GitHub" : "Supabase"} connected. Credentials remain server-side.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not connect integration.");
    } finally {
      setSavingIntegration(false);
    }
  }

  async function disconnectIntegration(provider: "github" | "supabase" | "gmail") {
    setSavingIntegration(true);
    try {
      const response = await fetch(`/api/integrations?provider=${provider}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Could not disconnect ${provider}.`);
      await refreshIntegrations();
      setNotice(`${provider === "github" ? "GitHub" : provider === "gmail" ? "Gmail" : "Supabase"} disconnected.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not disconnect integration.");
    } finally {
      setSavingIntegration(false);
    }
  }

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
        <section className="mt-8">
          <h2 className="text-xl font-semibold">External connections</h2>
          <p className="mt-1 text-sm text-slate-400">Secrets are sent only to the server and encrypted before storage. Connectors are available to the Agent only after you enable them below and approve their tools for a task.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <h3 className="font-semibold">GitHub</h3>
              <p className="mt-1 text-sm text-slate-400">{integrations.find((item) => item.id === "github")?.connected ? `Connected as ${integrations.find((item) => item.id === "github")?.account}` : "Use a fine-grained personal access token."}</p>
              <label className="mt-4 block text-xs text-slate-400" htmlFor="github-token">GitHub token</label>
              <input id="github-token" type="password" autoComplete="new-password" value={githubToken} onChange={(event) => setGithubToken(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1526] px-3 py-2" placeholder="Token stays in this form only" />
              <button onClick={() => void connectIntegration("github")} disabled={savingIntegration || githubToken.length < 20} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50">{savingIntegration ? "Saving..." : "Connect GitHub"}</button>
              {integrations.find((item) => item.id === "github")?.connected && <button onClick={() => void disconnectIntegration("github")} disabled={savingIntegration} className="ml-2 rounded-lg bg-white/8 px-4 py-2 text-sm disabled:opacity-50">Disconnect</button>}
            </article>
            <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <h3 className="font-semibold">Supabase</h3>
              <p className="mt-1 text-sm text-slate-400">Use a publishable/anon key and explicitly allowlist tables. Row Level Security remains enforced.</p>
              <label className="mt-3 block text-xs text-slate-400" htmlFor="supabase-url">Project URL</label>
              <input id="supabase-url" value={supabaseUrl} onChange={(event) => setSupabaseUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1526] px-3 py-2" placeholder="https://project-ref.supabase.co" />
              <label className="mt-3 block text-xs text-slate-400" htmlFor="supabase-key">Publishable or anon key</label>
              <input id="supabase-key" type="password" autoComplete="new-password" value={supabaseKey} onChange={(event) => setSupabaseKey(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1526] px-3 py-2" placeholder="Never use a service-role key" />
              <label className="mt-3 block text-xs text-slate-400" htmlFor="supabase-tables">Allowed table names (comma-separated)</label>
              <input id="supabase-tables" value={supabaseTables} onChange={(event) => setSupabaseTables(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1526] px-3 py-2" placeholder="customers, tickets" />
              <button onClick={() => void connectIntegration("supabase")} disabled={savingIntegration || !supabaseUrl || supabaseKey.length < 20 || !supabaseTables.trim()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50">{savingIntegration ? "Saving..." : "Connect Supabase"}</button>
              {integrations.find((item) => item.id === "supabase")?.connected && <button onClick={() => void disconnectIntegration("supabase")} disabled={savingIntegration} className="ml-2 rounded-lg bg-white/8 px-4 py-2 text-sm disabled:opacity-50">Disconnect</button>}
              {integrations.find((item) => item.id === "supabase")?.allowedTables?.length ? <p className="mt-2 text-xs text-slate-400">Allowed: {integrations.find((item) => item.id === "supabase")?.allowedTables?.join(", ")}</p> : null}
            </article>
            <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <h3 className="font-semibold">Gmail</h3>
              <p className="mt-1 text-sm text-slate-400">{integrations.find((item) => item.id === "gmail")?.connected ? `Connected as ${integrations.find((item) => item.id === "gmail")?.account}` : integrations.find((item) => item.id === "gmail")?.configured ? "Google OAuth is ready; approve read and send scopes on Google's consent page." : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server to enable OAuth."}</p>
              <a href="/api/integrations/gmail/connect" aria-disabled={!integrations.find((item) => item.id === "gmail")?.configured} className={`mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium ${integrations.find((item) => item.id === "gmail")?.configured ? "" : "pointer-events-none opacity-50"}`}>Connect Gmail</a>
              {integrations.find((item) => item.id === "gmail")?.connected && <button onClick={() => void disconnectIntegration("gmail")} disabled={savingIntegration} className="ml-2 rounded-lg bg-white/8 px-4 py-2 text-sm disabled:opacity-50">Disconnect</button>}
            </article>
            <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <h3 className="font-semibold">Remote Desktop Commander</h3>
              <p className="mt-1 text-sm text-slate-400">Not connected. Desktop control remains disabled until its exact vendor and supported API are identified.</p>
            </article>
          </div>
        </section>
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
