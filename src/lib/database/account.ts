import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/database/prisma";

export async function getAuthenticatedAccount() {
  const session = await auth();
  const email = session?.user?.email;
  const prisma = getPrisma();
  if (!email || !prisma) return null;

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: session.user?.name },
    create: { email, name: session.user?.name },
  });

  return { prisma, user };
}
