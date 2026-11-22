import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#08111f] text-white lg:pl-72">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/8 bg-[#0b1526] p-5 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-bold">A</div>
          <div><b>ALIF AI</b><p className="text-xs text-slate-400">Personal AI Agent</p></div>
        </div>
        <Link href="/chat" className="mb-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500">＋ New Chat</Link>
        <nav className="space-y-2 text-sm text-slate-300">
          {[["Dashboard", "/"], ["AI Chat", "/chat"], ["AI Agent", "/agent"], ["Plugins", "/plugins"], ["Files", "/files"], ["Settings", "/settings"]].map(([label, href]) =>
            <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 hover:bg-white/5">{label}</Link>)}
        </nav>
      </aside>
      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <header className="mb-10 flex items-center justify-between">
          <div><p className="text-sm text-blue-400">Good morning</p><h1 className="mt-1 text-3xl font-bold">What will you build today?</h1></div>
          <Link href="/chat" className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Open Chat</Link>
        </header>
        <div className="grid gap-5 md:grid-cols-3">
          {[["Gemini","Google AI Studio","gemini"],["Grok","xAI","grok"],["OpenRouter","Multi-model gateway","openrouter"]].map(([name,sub,id]) =>
            <div key={id} className="rounded-2xl border border-white/8 bg-[#101d31] p-5">
              <div className="mb-8 flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500/15 text-blue-400">{name[0]}</span><span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">Configure</span></div>
              <h2 className="font-semibold">{name}</h2><p className="mt-1 text-sm text-slate-400">{sub}</p>
            </div>)}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Link href="/chat" className="rounded-2xl border border-white/8 bg-gradient-to-br from-blue-600/20 to-violet-600/10 p-6 hover:border-blue-400/30"><p className="text-xs text-blue-300">ASSISTANT</p><h2 className="mt-2 text-xl font-semibold">Chat with an AI model</h2><p className="mt-2 text-sm text-slate-400">Stream answers, markdown and code securely.</p></Link>
          <Link href="/agent" className="rounded-2xl border border-white/8 bg-[#101d31] p-6 hover:border-violet-400/30"><p className="text-xs text-violet-300">AUTONOMOUS AGENT</p><h2 className="mt-2 text-xl font-semibold">Create an execution plan</h2><p className="mt-2 text-sm text-slate-400">Use bounded tools with explicit permissions.</p></Link>
        </div>
      </section>
    </main>
  );
}
