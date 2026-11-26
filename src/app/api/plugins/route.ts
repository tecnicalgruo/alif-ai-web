import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthenticatedAccount } from "@/lib/database/account";
import { getPrisma } from "@/lib/database/prisma";
import { pluginPreferenceSchema } from "@/lib/validation";

const plugins = [
  { slug: "web-search", name: "Web Search", description: "Search public sources through Tavily", enabled: true },
  { slug: "calculator", name: "Calculator", description: "Evaluate approved arithmetic expressions", enabled: true },
  { slug: "pdf-reader", name: "PDF Reader", description: "Extract text from PDF files", enabled: true },
  { slug: "txt-reader", name: "TXT Reader", description: "Read plain text files", enabled: true },
  { slug: "docx-reader", name: "DOCX Reader", description: "Extract DOCX text", enabled: true },
  { slug: "code-assistant", name: "Code Assistant", description: "Provide programming assistance", enabled: true },
  { slug: "youtube-search", name: "YouTube Search", description: "Registered; provider not configured", enabled: false },
  { slug: "weather", name: "Weather", description: "Registered; provider not configured", enabled: false },
  { slug: "custom-api", name: "Custom API", description: "Requires explicit configuration", enabled: false },
  { slug: "text-summarizer", name: "Text Summarizer", description: "Summarize provided text", enabled: true },
  { slug: "translation", name: "Translation", description: "Translate Bengali and English text", enabled: false },
  { slug: "image-analysis", name: "Image Analysis", description: "Registered; provider not configured", enabled: false },
] as const;

export async function GET() {
  const session = await auth();
  const prisma = getPrisma();
  let overrides = new Map<string, boolean>();

  if (session?.user?.email && prisma) {
    try {
      const account = await getAuthenticatedAccount();
      if (account) {
        const configurations = await prisma.pluginConfiguration.findMany({
          where: { userId: account.user.id },
          select: { plugin: { select: { slug: true } }, config: true },
        });
        overrides = new Map(configurations.flatMap(({ plugin, config }) => {
          if (config && typeof config === "object" && "enabled" in config && typeof config.enabled === "boolean") {
            return [[plugin.slug, config.enabled] as [string, boolean]];
          }
          return [];
        }));
      }
    } catch (error) {
      console.error("Could not load plugin preferences:", error);
      return Response.json({ error: "Could not load plugin preferences." }, { status: 503 });
    }
  }

  return Response.json({
    synced: Boolean(session?.user?.email && prisma),
    plugins: plugins.map((plugin) => ({
      ...plugin,
      enabled: overrides.get(plugin.slug) ?? plugin.enabled,
      configured: plugin.slug !== "web-search" || Boolean(process.env.WEB_SEARCH_API_KEY),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "Plugin preferences require a configured database." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  const parsed = pluginPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid plugin preference", details: parsed.error.flatten() }, { status: 400 });
  }
  const plugin = plugins.find(({ slug }) => slug === parsed.data.slug);
  if (!plugin) return Response.json({ error: "Unknown plugin" }, { status: 404 });

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Authentication or database is unavailable." }, { status: 503 });
    const savedPlugin = await prisma.plugin.upsert({
      where: { slug: plugin.slug },
      create: {
        slug: plugin.slug,
        name: plugin.name,
        description: plugin.description,
        enabled: plugin.enabled,
      },
      update: { name: plugin.name, description: plugin.description },
      select: { id: true },
    });
    await prisma.pluginConfiguration.upsert({
      where: { pluginId_userId: { pluginId: savedPlugin.id, userId: account.user.id } },
      create: { pluginId: savedPlugin.id, userId: account.user.id, config: { enabled: parsed.data.enabled } },
      update: { config: { enabled: parsed.data.enabled } },
    });
    return Response.json({ slug: plugin.slug, enabled: parsed.data.enabled, synced: true });
  } catch (error) {
    console.error("Could not save plugin preference:", error);
    return Response.json({ error: "Could not save plugin preference." }, { status: 503 });
  }
}
