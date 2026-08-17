import { NextResponse } from "next/server";
import { applyLivePokerBuyInRequest } from "@/lib/live-poker/apply-buy-in-request";
import {
  getAuthenticatedLivePokerUser,
  getLivePokerConvexSecret,
  livePokerConvex,
} from "@/lib/live-poker/server-auth";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export async function POST(request: Request) {
  const user = await getAuthenticatedLivePokerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    requestId?: string;
  } | null;
  if (!body?.requestId) {
    return NextResponse.json(
      { error: "Request ID is required" },
      { status: 400 }
    );
  }
  const requestId = body.requestId as Id<"livePokerBuyInRequests">;

  const buyInRequest = await livePokerConvex.action(
    api.live_poker.serverGetLivePokerBuyInRequestForClaim,
    {
      requestId,
      secret: getLivePokerConvexSecret(),
      userId: user._id,
    }
  );
  if (!buyInRequest) {
    return NextResponse.json(
      { error: "Approved buy-in request not found" },
      { status: 404 }
    );
  }
  if (buyInRequest.status === "CLAIMED") {
    return NextResponse.json({ idempotent: true, ok: true });
  }

  const player = await livePokerConvex.query(api.players.getPlayerByUserId, {
    userId: user._id,
  });
  if (!player || player._id !== buyInRequest.playerId) {
    return NextResponse.json(
      { error: "Player profile does not match this request" },
      { status: 403 }
    );
  }

  const workerResult = await applyLivePokerBuyInRequest({
    ...buyInRequest,
    playerName: player.name,
  });
  if (!("ok" in workerResult)) {
    return NextResponse.json(
      { error: workerResult.error },
      { status: workerResult.status }
    );
  }

  await livePokerConvex.action(
    api.live_poker.serverMarkLivePokerBuyInRequestClaimed,
    {
      requestId,
      secret: getLivePokerConvexSecret(),
      userId: user._id,
    }
  );
  return NextResponse.json({ ok: true });
}
