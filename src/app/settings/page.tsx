"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SettingsStatus = {
  authenticated: boolean;
  githubConfigured: boolean;
  databaseConfigured: boolean;
  user: { name?: string | null; email?: string | null } | null;
};

type DatabaseStatus = { configured: boolean; connected: boolean };
type ProviderStatus = { id: string; name: string; configured: boolean };

export default function SettingsPage() {
  const [session, setSession] = useState<SettingsStatus | null>(null);
  const [database, setDatabase] = useState<DatabaseStatus | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/session").then((response) => response.json()),
      fetch("/api/database/status").then((response) => response.json()),
      fetch("/api/status").then((response) => response.json()),
    ]).then(([sessionStatus, databaseStatus, providerStatus]) => {
      setSession(sessionStatus);
      setDatabase(databaseStatus);
      setProviders(providerStatus.providers ?? []);
    }).catch(() => setNotice("Could not load configuration status."));
  }, []);

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-blue-400">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-bold">Settings</h1>
        {notice && <p role="status" className="mt-4 text-sm text-amber-200">{notice}</p>}
        <section className="mt-8 space-y-3">
          <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="font-semibold">AI Providers</h2><p className="mt-1 text-sm text-slate-400">Keys stay in server-side environment variables.</p></div>
              <span className="text-xs text-slate-300">{providers.filter((provider) => provider.configured).length}/{providers.length} ready</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{providers.map((provider) => <span key={provider.id} className={`rounded-full px-3 py-1 text-xs ${provider.configured ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{provider.name}: {provider.configured ? "Connected" : "Not configured"}</span>)}</div>
          </article>
          <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
            <h2 className="font-semibold">PostgreSQL</h2>
            <p className="mt-1 text-sm text-slate-400">{database?.connected ? "Connected and ready." : database?.configured ? "Configured but connection failed." : "DATABASE_URL is not configured; local history still works."}</p>
          </article>
          <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
            <h2 className="font-semibold">Account</h2>
            <p className="mt-1 text-sm text-slate-400">{session?.authenticated ? `Signed in${session.user?.name ? ` as ${session.user.name}` : ""}.` : session?.githubConfigured ? "Sign in to sync conversation history." : "GitHub OAuth and AUTH_SECRET must be configured to enable sign-in."}</p>
            {!session?.authenticated && session?.githubConfigured && <Link href="/login" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Sign in with GitHub</Link>}
          </article>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/history" className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm">Chat history</Link>
            <Link href="/memory" className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm">Memory settings</Link>
          </div>
          <article className="rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="font-semibold">Configure API Keys</h2><p className="mt-1 text-sm text-slate-400">Add or update GEMINI_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY, and WEB_SEARCH_API_KEY in Vercel Project Settings. Never enter private keys in browser code or chat.</p></article>
        </section>
      </div>
    </main>
  );
}
