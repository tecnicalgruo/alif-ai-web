import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const githubConfigured = Boolean(
  process.env.GITHUB_ID && process.env.GITHUB_SECRET && process.env.AUTH_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: githubConfigured
    ? [GitHub({
        clientId: process.env.GITHUB_ID!,
        clientSecret: process.env.GITHUB_SECRET!,
      })]
    : [],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});

export { githubConfigured };
