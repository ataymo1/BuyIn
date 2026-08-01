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
    buyIn: number;
    cashOut: number;
    gameId?: string;
    playerId: string;
    settledAt?: number;
    settlementId?: string;
    tableId?: string;
    userId: string;
  };
  if (!(body.settlementId && body.settledAt)) {
    return NextResponse.json(
      { error: "Settlement idempotency fields are required" },
      { status: 400 }
    );
  }

  const gamePlayer = await livePokerConvex.action(
    api.live_poker.serverSettlePlayerStack,
    {
      buyIn: body.buyIn,
      cashOut: body.cashOut,
      gameId: body.gameId as Id<"games"> | undefined,
      playerId: body.playerId as Id<"players">,
      secret: getLivePokerConvexSecret(),
      settledAt: body.settledAt,
      settlementId: body.settlementId,
      tableId: body.tableId as Id<"livePokerTables"> | undefined,
      userId: body.userId as Id<"users">,
    }
  );

  return NextResponse.json({ gamePlayer });
}
