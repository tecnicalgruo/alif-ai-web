"use client";

import { useState } from "react";
import Link from "next/link";

export default function AgentPage() {
  const [objective, setObjective] = useState("");
  const [calculator, setCalculator] = useState(true);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective, approvedTools: calculator ? ["calculator"] : [] }) });
    setResult(await response.json());
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between"><div><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">AI Agent Workspace</h1></div></div>
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <section className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
            <label className="text-sm text-slate-300">Objective</label>
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Example: Calculate 125 * 8 + 20" className="mt-2 h-36 w-full resize-none rounded-xl border border-white/10 bg-[#0b1526] p-4 outline-none" />
            <button disabled={loading || objective.trim().length < 3} onClick={run} className="mt-4 rounded-xl bg-violet-600 px-5 py-3 font-semibold disabled:opacity-50">{loading ? "Planning..." : "Run Agent"}</button>
          </section>
          <aside className="rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="font-semibold">Approved Tools</h2><label className="mt-4 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={calculator} onChange={(e) => setCalculator(e.target.checked)} /> Calculator</label><p className="mt-5 text-xs text-slate-500">Sensitive or external operations require separate approval.</p></aside>
        </div>
        {result && <section className="mt-5 rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="mb-3 font-semibold">Execution Result</h2><pre className="overflow-auto whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(result, null, 2)}</pre></section>}
      </div>
    </main>
  );
}
