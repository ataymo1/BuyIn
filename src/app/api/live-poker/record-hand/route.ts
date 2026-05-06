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
    actionLog: string[];
    bigBlind: number;
    communityCards: string[];
    dealerSeat: number;
    gameId?: string;
    handNumber: number;
    pot: number;
    smallBlind: number;
    tableId?: string;
    winners: Array<{
      amount: number;
      description?: string;
      playerId: string;
      seatIndex: number;
      userId: string;
    }>;
  };

  await convex.mutation(api.live_poker.recordCompletedHand, {
    actionLog: body.actionLog,
    bigBlind: body.bigBlind,
    communityCards: body.communityCards,
    completedAt: Date.now(),
    dealerSeat: body.dealerSeat,
    gameId: body.gameId as Id<"games"> | undefined,
    handNumber: body.handNumber,
    pot: body.pot,
    smallBlind: body.smallBlind,
    tableId: body.tableId as Id<"livePokerTables"> | undefined,
    winners: body.winners.map((winner) => ({
      ...winner,
      playerId: winner.playerId as Id<"players">,
      userId: winner.userId as Id<"users">,
    })),
  });

  return NextResponse.json({ ok: true });
}
