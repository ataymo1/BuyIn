import { NextResponse } from "next/server";
import {
  getLivePokerConvexSecret,
  livePokerConvex,
} from "@/lib/live-poker/server-auth";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export async function POST(request: Request) {
  const webhookSecret = process.env.LIVE_POKER_WEBHOOK_SECRET;
  if (
    !webhookSecret ||
    request.headers.get("x-live-poker-secret") !== webhookSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    actionLog: string[];
    bigBlind: number;
    communityCards: string[];
    completedAt: number;
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

  await livePokerConvex.action(api.live_poker.serverRecordCompletedHand, {
    actionLog: body.actionLog,
    bigBlind: body.bigBlind,
    communityCards: body.communityCards,
    completedAt: body.completedAt,
    dealerSeat: body.dealerSeat,
    gameId: body.gameId as Id<"games"> | undefined,
    handNumber: body.handNumber,
    pot: body.pot,
    secret: getLivePokerConvexSecret(),
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
