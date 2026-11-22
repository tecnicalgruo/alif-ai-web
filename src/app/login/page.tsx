import Link from "next/link";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08111f] px-5 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101d31] p-6 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-bold">A</div>
        <h1 className="text-2xl font-bold">Sign in to ALIF AI</h1>
        <p className="mt-2 text-sm text-slate-400">Use GitHub to save private conversations and preferences.</p>
        <form action={async () => { "use server"; await signIn("github"); }} className="mt-6">
          <button className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950">Continue with GitHub</button>
        </form>
        <Link href="/" className="mt-5 block text-sm text-slate-400 hover:text-white">Continue locally</Link>
      </section>
    </main>
  );
}
