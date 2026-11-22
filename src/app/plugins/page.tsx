import Link from "next/link";

const plugins = ["Web Search","Calculator","PDF Reader","TXT Reader","DOCX Reader","Code Assistant","YouTube Search","Weather","Custom API","Text Summarizer","Translation","Image Analysis"];

export default function PluginsPage() {
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">Plugin Marketplace</h1><p className="mt-2 text-slate-400">Safe, registered tools for ALIF AI.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{plugins.map((plugin, index) => <article key={plugin} className="rounded-2xl border border-white/8 bg-[#101d31] p-5"><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{index + 1}</div><h2 className="font-semibold">{plugin}</h2><p className="mt-2 text-sm text-slate-400">{index === 0 ? "Search public sources with a configured provider." : "Registered plugin; configuration available through the plugin manager."}</p></article>)}</div>
      </div>
    </main>
  );
}
