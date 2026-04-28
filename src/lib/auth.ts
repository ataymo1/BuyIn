import { ConvexHttpClient } from "convex/browser";
import { headers } from "next/headers";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ConvexAdapter } from "./convex-adapter";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

const convex = new ConvexHttpClient(convexUrl);

const nextAuth = NextAuth({
  adapter: ConvexAdapter(convex),
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Allow linking accounts with the same email
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

function createE2ESession() {
  return {
    user: {
      id: process.env.E2E_USER_ID ?? "e2e-user",
      email: process.env.E2E_USER_EMAIL ?? "e2e@example.com",
      name: "E2E User",
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

async function shouldBypassAuthForE2E() {
  if (process.env.E2E_AUTH_BYPASS === "1") {
    return true;
  }

  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  try {
    return (await headers()).get("x-e2e-auth") === "1";
  } catch {
    return false;
  }
}

export async function auth() {
  if (await shouldBypassAuthForE2E()) {
    return createE2ESession();
  }

  return nextAuth.auth();
}
