import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

const convex = new ConvexHttpClient(convexUrl);

export async function POST(request: Request) {
  const secret = process.env.LIVE_POKER_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-live-poker-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    buyIn: number;
    cashOut: number;
    gameId?: string;
    playerId: string;
    tableId?: string;
    userId: string;
  };

  const gamePlayer = await convex.mutation(api.live_poker.settlePlayerStack, {
    buyIn: body.buyIn,
    cashOut: body.cashOut,
    gameId: body.gameId as Id<"games"> | undefined,
    playerId: body.playerId as Id<"players">,
    tableId: body.tableId as Id<"livePokerTables"> | undefined,
    userId: body.userId as Id<"users">,
  });

  return NextResponse.json({ gamePlayer });
}
