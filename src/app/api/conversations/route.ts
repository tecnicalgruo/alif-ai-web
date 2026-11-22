import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/database/prisma";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(30000),
  model: z.string().max(200).optional(),
});

const saveSchema = z.object({
  title: z.string().min(1).max(200),
  messages: z.array(messageSchema).min(1).max(100),
});

export async function GET() {
  const prisma = getPrisma();
  if (!prisma) return Response.json({ configured: false, conversations: [] });
  const session = await auth();
  if (!session?.user?.email) return Response.json({ configured: true, conversations: [] });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json({ configured: true, conversations: [] });
  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ configured: true, conversations });
}

export async function POST(request: NextRequest) {
  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid conversation", details: parsed.error.flatten() }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return Response.json({ configured: false, saved: false });
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });

  const user = await prisma.user.upsert({
    where: { email: session.user.email },
    update: { name: session.user.name },
    create: { email: session.user.email, name: session.user.name },
  });
  const conversation = await prisma.conversation.create({
    data: {
      title: parsed.data.title,
      userId: user.id,
      messages: { create: parsed.data.messages.map((message) => ({ role: message.role, content: message.content, model: message.model })) },
    },
    include: { messages: true },
  });
  return Response.json({ configured: true, saved: true, conversation });
}

export async function DELETE(request: NextRequest) {
  const prisma = getPrisma();
  if (!prisma) return Response.json({ configured: false, deleted: false });
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Conversation id is required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json({ deleted: false });
  await prisma.conversation.deleteMany({ where: { id, userId: user.id } });
  return Response.json({ deleted: true });
}
