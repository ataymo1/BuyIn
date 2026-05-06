import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signLivePokerToken } from "@/lib/live-poker/auth";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

const convex = new ConvexHttpClient(convexUrl);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    tableId?: string;
  } | null;

  if (!body?.tableId) {
    return NextResponse.json(
      { error: "Table ID is required" },
      { status: 400 }
    );
  }

  const user = await convex.query(api.auth.getUserByEmail, {
    email: session.user.email,
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let access = await convex.query(api.live_poker.getLivePokerAccess, {
    tableId: body.tableId as Id<"livePokerTables">,
    userId: user._id,
  });

  if (access && !access.player) {
    const playerId = await convex.mutation(
      api.players.getOrCreatePlayerForUser,
      {
        userId: user._id,
        name: user.name ?? user.email ?? "Player",
      }
    );
    const player = await convex.query(api.players.getPlayerByUserId, {
      userId: user._id,
    });
    access = {
      ...access,
      player: player
        ? { id: player._id, name: player.name }
        : { id: playerId, name: user.name ?? user.email ?? "Player" },
    };
  }

  if (!access?.player) {
    return NextResponse.json(
      { error: "You must be signed in with a player profile to play" },
      { status: 403 }
    );
  }

  const exp = Math.floor(Date.now() / 1000) + 5 * 60;
  const token = await signLivePokerToken({
    exp,
    tableId: body.tableId,
    playerId: access.player.id,
    playerName: access.player.name,
    userId: user._id,
  });

  return NextResponse.json({
    config: access.table,
    expiresAt: exp * 1000,
    player: access.player,
    token,
  });
}
