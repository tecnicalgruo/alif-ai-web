import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-blue-400">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold">Settings</h1>
        <section className="mt-8 space-y-3">
          {[["Provider API Keys","Configured only through server environment variables"],["Database","PostgreSQL connection through DATABASE_URL"],["Authentication","Sign in with GitHub"],["Privacy","Delete saved conversations"]].map(([title,description]) => <article key={title} className="rounded-2xl border border-white/8 bg-[#101d31] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-400">{description}</p></article>)}
          <Link href="/login" className="block rounded-2xl bg-blue-600 px-5 py-4 text-center font-semibold">Sign in with GitHub</Link>
        </section>
      </div>
    </main>
  );
}
