import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAuthenticatedAccount } from "@/lib/database/account";
import {
  loadIntegration,
  removeIntegration,
  saveIntegration,
} from "@/lib/integrations/vault";

const connectionSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("github"),
    token: z.string().min(20).max(500),
  }),
  z.object({
    provider: z.literal("supabase"),
    projectUrl: z.string().url(),
    publishableKey: z.string().min(20).max(1000),
    allowedTables: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/)).min(1).max(50),
  }),
]);

function isReadOnlySupabaseKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  if (value.startsWith("sb_publishable_")) return true;
  const payload = value.split(".")[1];
  if (!payload) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: unknown };
    return decoded.role === "anon";
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Account database is unavailable." }, { status: 503 });
    const [github, supabase, gmail] = await Promise.all([
      loadIntegration(account.prisma, account.user.id, "github"),
      loadIntegration(account.prisma, account.user.id, "supabase"),
      loadIntegration(account.prisma, account.user.id, "gmail"),
    ]);

    return Response.json({
      integrations: [
        { id: "github", name: "GitHub", configured: true, connected: Boolean(github), account: github?.login ?? null },
        { id: "supabase", name: "Supabase", configured: true, connected: Boolean(supabase), account: null, allowedTables: supabase?.allowedTables ?? [] },
        {
          id: "gmail",
          name: "Gmail",
          configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          connected: Boolean(gmail),
          account: gmail?.email ?? null,
        },
        { id: "remote-desktop-commander", name: "Remote Desktop Commander", configured: false, connected: false, account: null },
      ],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load integrations:", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Could not load integrations." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }

  const parsed = connectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Provide valid GitHub or Supabase connection details." }, { status: 400 });
  }

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Account database is unavailable." }, { status: 503 });

    if (parsed.data.provider === "github") {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${parsed.data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return Response.json({ error: "GitHub rejected this token. Check its validity and permissions." }, { status: 400 });
      const profile: unknown = await response.json();
      const parsedProfile = z.object({ login: z.string().min(1).max(100) }).safeParse(profile);
      if (!parsedProfile.success) return Response.json({ error: "GitHub returned an invalid account profile." }, { status: 502 });
      await saveIntegration(account.prisma, account.user.id, "github", {
        accessToken: parsed.data.token,
        login: parsedProfile.data.login,
      });
      return Response.json({ connected: true, provider: "github", account: parsedProfile.data.login });
    }

    const projectUrl = new URL(parsed.data.projectUrl);
    if (
      projectUrl.protocol !== "https:"
      || !/^[a-z0-9-]+\.supabase\.co$/i.test(projectUrl.hostname)
      || projectUrl.username
      || projectUrl.password
      || projectUrl.port
      || !isReadOnlySupabaseKey(parsed.data.publishableKey)
    ) {
      return Response.json({ error: "Use a Supabase HTTPS project URL and a publishable/anon key. Secret/service-role keys are not accepted." }, { status: 400 });
    }
    const baseUrl = projectUrl.origin;
    const testResponse = await fetch(`${baseUrl}/rest/v1/`, {
      headers: {
        apikey: parsed.data.publishableKey,
        Authorization: `Bearer ${parsed.data.publishableKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!testResponse.ok) return Response.json({ error: `Supabase connection failed (${testResponse.status}).` }, { status: 400 });
    await saveIntegration(account.prisma, account.user.id, "supabase", {
      projectUrl: baseUrl,
      publishableKey: parsed.data.publishableKey,
      allowedTables: [...new Set(parsed.data.allowedTables)],
    });
    return Response.json({
      connected: true,
      provider: "supabase",
      allowedTables: [...new Set(parsed.data.allowedTables)],
    });
  } catch (error) {
    console.error("Could not connect integration:", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Could not connect integration. Verify the credentials and server configuration." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const provider = new URL(request.url).searchParams.get("provider");
  if (provider !== "github" && provider !== "supabase" && provider !== "gmail") {
    return Response.json({ error: "Choose a supported integration to disconnect." }, { status: 400 });
  }

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Account database is unavailable." }, { status: 503 });
    await removeIntegration(account.prisma, account.user.id, provider);
    return Response.json({ disconnected: true, provider });
  } catch (error) {
    console.error("Could not disconnect integration:", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Could not disconnect integration." }, { status: 503 });
  }
}
