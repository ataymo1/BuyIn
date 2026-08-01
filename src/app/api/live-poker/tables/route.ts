import { NextResponse } from "next/server";
import {
  getAuthenticatedLivePokerUser,
  getLivePokerConvexSecret,
  livePokerConvex,
} from "@/lib/live-poker/server-auth";
import { api } from "../../../../../convex/_generated/api";

export async function POST(request: Request) {
  const user = await getAuthenticatedLivePokerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    bigBlind?: number;
    maxBuyIn?: number;
    minBuyIn?: number;
    seatCount?: number;
    smallBlind?: number;
    title?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const tableId = await livePokerConvex.action(
      api.live_poker.serverCreateLivePokerTable,
      {
        bigBlind: Number(body.bigBlind),
        createdById: user._id,
        maxBuyIn: Number(body.maxBuyIn),
        minBuyIn: Number(body.minBuyIn),
        seatCount: Number(body.seatCount),
        secret: getLivePokerConvexSecret(),
        smallBlind: Number(body.smallBlind),
        title: body.title ?? "",
      }
    );
    return NextResponse.json({ tableId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create table",
      },
      { status: 400 }
    );
  }
}
