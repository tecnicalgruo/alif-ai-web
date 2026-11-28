"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readLocalAccountPreferences } from "@/lib/account-preferences";

type IntegrationStatus = { id: string; connected: boolean; account: string | null };
type AgentTool =
  | "calculator"
  | "web_search"
  | "text_summarizer"
  | "github_list_repositories"
  | "github_search_issues"
  | "github_create_issue"
  | "supabase_read_rows"
  | "supabase_insert_row"
  | "supabase_update_rows"
  | "gmail_search_messages"
  | "gmail_read_message"
  | "gmail_send_message";

const externalToolGroups: { title: string; integration: string; tools: { id: AgentTool; label: string; write?: boolean }[] }[] = [
  { title: "GitHub", integration: "github", tools: [
    { id: "github_list_repositories", label: "List my repositories" },
    { id: "github_search_issues", label: "Search my issues" },
    { id: "github_create_issue", label: "Create an issue", write: true },
  ] },
  { title: "Supabase", integration: "supabase", tools: [
    { id: "supabase_read_rows", label: "Read allowlisted rows" },
    { id: "supabase_insert_row", label: "Insert a row", write: true },
    { id: "supabase_update_rows", label: "Update rows", write: true },
  ] },
  { title: "Gmail", integration: "gmail", tools: [
    { id: "gmail_search_messages", label: "Search messages" },
    { id: "gmail_read_message", label: "Read a message" },
    { id: "gmail_send_message", label: "Send an email", write: true },
  ] },
];

export default function AgentPage() {
  const [objective, setObjective] = useState("");
  const [approvedTools, setApprovedTools] = useState<AgentTool[]>(["calculator"]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [language, setLanguage] = useState<"en" | "bn">("en");

  useEffect(() => {
    let active = true;
    fetch("/api/preferences")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load preferences.");
        if (!active) return;
        const preferences = data.synced ? data.preferences : readLocalAccountPreferences();
        setLanguage(preferences.language);
      })
      .catch(() => {
        if (active) setLanguage(readLocalAccountPreferences().language);
      });
    Promise.all([fetch("/api/integrations"), fetch("/api/plugins")])
      .then(async ([integrationResponse, pluginResponse]) => {
        const [integrationData, pluginData] = await Promise.all([integrationResponse.json(), pluginResponse.json()]);
        if (!active) return;
        if (integrationResponse.ok) setIntegrations(integrationData.integrations ?? []);
        setEnabledPlugins((pluginData.plugins ?? []).filter((plugin: { enabled: boolean }) => plugin.enabled).map((plugin: { slug: string }) => plugin.slug));
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load integration permissions.");
      });
    return () => { active = false; };
  }, []);

  function toggleTool(tool: AgentTool) {
    setApprovedTools((current) => current.includes(tool)
      ? current.filter((value) => value !== tool)
      : [...current, tool]);
  }

  async function run() {
    setLoading(true);
    setResult(null);
    setNotice("");
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective, approvedTools, language }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Agent request failed.");
      setResult(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Agent request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between"><div><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">AI Agent Workspace</h1></div></div>
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <section className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
            <label className="text-sm text-slate-300">Objective</label>
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Example: Calculate 125 * 8 + 20" className="mt-2 h-36 w-full resize-none rounded-xl border border-white/10 bg-[#0b1526] p-4 outline-none" />
            <button disabled={loading || objective.trim().length < 3} onClick={() => void run()} className="mt-4 rounded-xl bg-violet-600 px-5 py-3 font-semibold disabled:opacity-50">{loading ? "Planning..." : "Run Agent"}</button>
          </section>
          <aside className="rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="font-semibold">Approve Tools</h2>
            <label className="mt-4 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={approvedTools.includes("calculator")} onChange={() => toggleTool("calculator")} /> Calculator</label>
            <label className="mt-3 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={approvedTools.includes("text_summarizer")} onChange={() => toggleTool("text_summarizer")} /> Summarize supplied text</label>
            <label className="mt-3 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={approvedTools.includes("web_search")} onChange={() => toggleTool("web_search")} /> Search the public web</label>
            {approvedTools.includes("web_search") && <p className="mt-2 text-xs text-amber-200">The search query will be sent to the configured external provider.</p>}
            {externalToolGroups.map((group) => {
              const connected = integrations.some((integration) => integration.id === group.integration && integration.connected);
              const enabled = enabledPlugins.includes(group.integration);
              return <fieldset key={group.integration} className="mt-5 border-t border-white/10 pt-4">
                <legend className="font-medium text-slate-200">{group.title}{connected ? "" : " — not connected"}{connected && !enabled ? " — disabled in Plugins" : ""}</legend>
                {group.tools.map((tool) => <label key={tool.id} className={`mt-3 flex items-center gap-2 text-sm ${connected && enabled ? "text-slate-300" : "text-slate-500"}`}>
                  <input type="checkbox" checked={approvedTools.includes(tool.id)} disabled={!connected || !enabled} onChange={() => toggleTool(tool.id)} />
                  <span>{tool.label}</span>
                  {tool.write && <span className="text-xs text-amber-300">write</span>}
                </label>)}
              </fieldset>;
            })}
            {approvedTools.some((tool) => tool.endsWith("_create_issue") || tool.endsWith("_insert_row") || tool.endsWith("_update_rows") || tool.endsWith("_send_message")) && <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100">Write approval lets the agent make external changes during this task. State the exact target and content in your objective. No delete tools are available.</p>}
            <p className="mt-5 text-xs text-slate-500">Only selected tools are available to the planner. External operations are opt-in; arbitrary code and destructive operations are never run.</p>
          </aside>
        </div>
        {notice && <p role="status" className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">{notice}</p>}
        {result && <section className="mt-5 rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="mb-3 font-semibold">Execution Result</h2><pre className="overflow-auto whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(result, null, 2)}</pre></section>}
      </div>
    </main>
  );
}
