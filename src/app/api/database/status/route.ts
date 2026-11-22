import { getPrisma } from "@/lib/database/prisma";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ configured: false, connected: false });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ configured: true, connected: false });
  }
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    const userCount = await prisma.user.count();
    return Response.json({ configured: true, connected: true, migrationsReady: true, userCount });
  } catch (error) {
    return Response.json({
      configured: true,
      connected: false,
      migrationsReady: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "Database connection failed",
    }, { status: 503 });
  }
}
