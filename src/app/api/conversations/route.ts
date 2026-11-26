import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/database/prisma";
import { conversationSaveSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ error: "Conversation database is not configured" }, { status: 503 });
  }

  try {
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: { name: session.user.name },
      create: { email: session.user.email, name: session.user.name },
      select: { id: true },
    });
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return Response.json({ conversations });
  } catch {
    return Response.json({ error: "Could not load conversation history" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ error: "Conversation database is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  const parsed = conversationSaveSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid conversation", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const owner = await prisma.user.upsert({
      where: { email: session.user.email },
      update: { name: session.user.name },
      create: { email: session.user.email, name: session.user.name },
      select: { id: true },
    });
    const { id, title, messages } = parsed.data;
    let conversation;

    if (id) {
      const existing = await prisma.conversation.findFirst({
        where: { id, userId: owner.id },
        select: { id: true },
      });
      if (existing) {
        conversation = await prisma.$transaction(async (transaction) => {
          await transaction.message.deleteMany({ where: { conversationId: existing.id } });
          return transaction.conversation.update({
            where: { id: existing.id },
            data: {
              title,
              updatedAt: new Date(),
              messages: { create: messages },
            },
            include: { messages: { orderBy: { createdAt: "asc" } } },
          });
        });
      }
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          title,
          userId: owner.id,
          messages: { create: messages },
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }
    return Response.json({ conversation });
  } catch {
    return Response.json({ error: "Could not save conversation" }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ error: "Conversation database is not configured" }, { status: 503 });
  }

  const deleteAll = new URL(request.url).searchParams.get("all") === "true";
  const id = new URL(request.url).searchParams.get("id");
  if (!deleteAll && !id) {
    return Response.json({ error: "Conversation id is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: { name: session.user.name },
      create: { email: session.user.email, name: session.user.name },
      select: { id: true },
    });
    const result = await prisma.conversation.deleteMany({
      where: { userId: user.id, ...(id ? { id } : {}) },
    });
    return Response.json({ deleted: deleteAll || result.count > 0 });
  } catch {
    return Response.json({ error: "Could not delete conversation" }, { status: 503 });
  }
}
