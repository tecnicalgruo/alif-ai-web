import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAuthenticatedAccount } from "@/lib/database/account";
import { loadIntegration, saveIntegration } from "@/lib/integrations/vault";

const stateCookieName = "alif-gmail-oauth-state";
const tokenSchema = z.object({
  access_token: z.string().min(20),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(20).optional(),
});
const profileSchema = z.object({
  email: z.string().email(),
  verified_email: z.boolean(),
});

function applicationUrl(path: string) {
  const origin = process.env.APP_URL ?? "https://alif-ai-web.vercel.app";
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_URL must use HTTPS.");
  }
  return new URL(path, url);
}

function redirectToPlugins(status: "connected" | "error") {
  const destination = applicationUrl("/plugins");
  destination.searchParams.set("integration", "gmail");
  destination.searchParams.set("status", status);
  const response = Response.redirect(destination);
  response.headers.set(
    "Set-Cookie",
    `${stateCookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/api/integrations/gmail/callback; Max-Age=0`,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const stateSecret = process.env.AUTH_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(stateCookieName)?.value ?? "";
  const [storedNonce, storedSignature] = storedState.split(".");
  if (
    !stateSecret
    || !code
    || !state
    || !storedNonce
    || !storedSignature
    || state !== storedNonce
  ) {
    return redirectToPlugins("error");
  }
  const expectedSignature = createHmac("sha256", stateSecret).update(`${storedNonce}:${session.user.email}`).digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(storedSignature, "base64url");
  } catch {
    return redirectToPlugins("error");
  }
  if (
    actualSignature.length !== expectedSignature.length
    || !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return redirectToPlugins("error");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirectToPlugins("error");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: applicationUrl("/api/integrations/gmail/callback").toString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) return redirectToPlugins("error");
    const tokenRaw: unknown = await tokenResponse.json();
    const token = tokenSchema.safeParse(tokenRaw);
    if (!token.success) return redirectToPlugins("error");

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.data.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok) return redirectToPlugins("error");
    const profileRaw: unknown = await profileResponse.json();
    const profile = profileSchema.safeParse(profileRaw);
    if (!profile.success || !profile.data.verified_email) return redirectToPlugins("error");

    const account = await getAuthenticatedAccount();
    if (!account) return redirectToPlugins("error");
    const previousIntegration = await loadIntegration(account.prisma, account.user.id, "gmail");
    await saveIntegration(account.prisma, account.user.id, "gmail", {
      accessToken: token.data.access_token,
      refreshToken: token.data.refresh_token ?? previousIntegration?.refreshToken,
      expiresAt: Date.now() + token.data.expires_in * 1000,
      email: profile.data.email,
    });
    return redirectToPlugins("connected");
  } catch (error) {
    console.error("Could not complete Gmail OAuth:", error);
    return redirectToPlugins("error");
  }
}
