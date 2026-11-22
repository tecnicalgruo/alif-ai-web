import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  return Response.json({
    authenticated: Boolean(session?.user),
    user: session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : null,
  });
}
