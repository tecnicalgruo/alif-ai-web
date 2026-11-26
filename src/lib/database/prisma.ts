import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export function getPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}
