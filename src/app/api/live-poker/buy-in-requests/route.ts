import { NextResponse } from "next/server";
import {
  getAuthenticatedLivePokerUser,
  getLivePokerConvexSecret,
  livePokerConvex,
} from "@/lib/live-poker/server-auth";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export async function GET(request: Request) {
  const user = await getAuthenticatedLivePokerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableId = new URL(request.url).searchParams.get("tableId");
  if (!tableId) {
    return NextResponse.json(
      { error: "A tableId is required" },
      { status: 400 }
    );
  }

  try {
    const requests = await livePokerConvex.action(
      api.live_poker.serverGetLivePokerBuyInRequests,
      {
        secret: getLivePokerConvexSecret(),
        tableId: tableId as Id<"livePokerTables">,
        userId: user._id,
      }
    );
    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load buy-in requests",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedLivePokerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    amount?: number;
    seatIndex?: number;
    tableId?: string;
    type?: "ADD_ON" | "INITIAL";
  } | null;
  if (!(body?.tableId && body.type)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const player = await livePokerConvex.query(api.players.getPlayerByUserId, {
    userId: user._id,
  });
  if (!player) {
    return NextResponse.json(
      { error: "A player profile is required" },
      { status: 403 }
    );
  }

  try {
    const requestId = await livePokerConvex.action(
      api.live_poker.serverCreateLivePokerBuyInRequest,
      {
        amount: Number(body.amount),
        playerId: player._id,
        seatIndex: body.seatIndex,
        secret: getLivePokerConvexSecret(),
        tableId: body.tableId as Id<"livePokerTables">,
        type: body.type,
        userId: user._id,
      }
    );
    return NextResponse.json({ requestId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to request buy-in",
      },
      { status: 400 }
    );
  }
}
