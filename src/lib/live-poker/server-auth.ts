import { ConvexHttpClient } from "convex/browser";
import { auth } from "@/lib/auth";
import { api } from "../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

export const livePokerConvex = new ConvexHttpClient(convexUrl);

export function getLivePokerConvexSecret() {
  const secret = process.env.LIVE_POKER_CONVEX_SECRET;
  if (!secret) {
    throw new Error("LIVE_POKER_CONVEX_SECRET is not configured");
  }
  return secret;
}

export async function getAuthenticatedLivePokerUser() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }
  return await livePokerConvex.query(api.auth.getUserByEmail, {
    email: session.user.email,
  });
}
