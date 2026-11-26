import { connection } from "next/server";
import { getPrisma } from "@/lib/database/prisma";

export async function GET() {
  await connection();
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ configured: false, connected: false });
  }

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return Response.json({ configured: true, connected: true });
  } catch {
    return Response.json(
      { configured: true, connected: false, error: "Database connection failed" },
      { status: 503 },
    );
  }
}
