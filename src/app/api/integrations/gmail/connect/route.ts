import { createHmac, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";

const stateCookieName = "alif-gmail-oauth-state";

function applicationUrl(path: string) {
  const origin = process.env.APP_URL ?? "https://alif-ai-web.vercel.app";
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_URL must use HTTPS.");
  }
  return new URL(path, url);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const stateSecret = process.env.AUTH_SECRET;
  if (!clientId || !clientSecret || !stateSecret || stateSecret.length < 32) {
    return Response.json({ error: "Gmail OAuth is not configured on the server." }, { status: 503 });
  }

  const state = randomBytes(32).toString("base64url");
  const signature = createHmac("sha256", stateSecret).update(`${state}:${session.user.email}`).digest("base64url");
  const callbackUrl = applicationUrl("/api/integrations/gmail/callback");
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl.toString(),
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: googleUrl.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `${stateCookieName}=${state}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/api/integrations/gmail/callback; Max-Age=600`,
    },
  });
}
