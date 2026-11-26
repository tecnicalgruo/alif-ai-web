import { auth } from "@/lib/auth";
import { defaultAccountPreferences } from "@/lib/account-preferences";
import { getAuthenticatedAccount } from "@/lib/database/account";
import { getPrisma } from "@/lib/database/prisma";
import { accountPreferencesSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ preferences: defaultAccountPreferences, synced: false });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ preferences: defaultAccountPreferences, synced: false });
  }

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ preferences: defaultAccountPreferences, synced: false });
    const preference = await prisma.userPreference.findUnique({
      where: { userId_key: { userId: account.user.id, key: "settings" } },
      select: { value: true },
    });
    if (!preference) return Response.json({ preferences: defaultAccountPreferences, synced: true });

    const parsed = accountPreferencesSchema.safeParse(JSON.parse(preference.value));
    if (!parsed.success) {
      return Response.json({ error: "Saved account preferences are invalid." }, { status: 500 });
    }
    return Response.json({ preferences: parsed.data, synced: true });
  } catch (error) {
    console.error("Could not load account preferences:", error);
    return Response.json({ error: "Could not load account preferences." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ error: "Account preferences require a configured database." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  const parsed = accountPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid account preferences", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await getAuthenticatedAccount();
    if (!account) return Response.json({ error: "Authentication or database is unavailable." }, { status: 503 });
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: account.user.id, key: "settings" } },
      create: { userId: account.user.id, key: "settings", value: JSON.stringify(parsed.data) },
      update: { value: JSON.stringify(parsed.data) },
    });
    return Response.json({ preferences: parsed.data, synced: true });
  } catch (error) {
    console.error("Could not save account preferences:", error);
    return Response.json({ error: "Could not save account preferences." }, { status: 503 });
  }
}
