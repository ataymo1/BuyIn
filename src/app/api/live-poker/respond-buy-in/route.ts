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
    status?: "REJECTED";
  } | null;
  if (!body?.requestId) {
    return NextResponse.json(
      { error: "Request ID is required" },
      { status: 400 }
    );
  }
  const requestId = body.requestId as Id<"livePokerBuyInRequests">;
  const secret = getLivePokerConvexSecret();

  if (body.status === "REJECTED") {
    await livePokerConvex.action(
      api.live_poker.serverRejectLivePokerBuyInRequest,
      { requestId, secret, userId: user._id }
    );
    return NextResponse.json({ ok: true });
  }

  const buyInRequest = await livePokerConvex.query(
    api.live_poker.getLivePokerBuyInRequestForApproval,
    { requestId, userId: user._id }
  );
  if (!buyInRequest) {
    return NextResponse.json(
      { error: "Pending buy-in request not found" },
      { status: 404 }
    );
  }
  if (buyInRequest.status === "CLAIMED") {
    return NextResponse.json({ idempotent: true, ok: true });
  }

  const workerResult = await applyLivePokerBuyInRequest({
    ...buyInRequest,
    playerName: buyInRequest.playerName,
  });
  if (!("ok" in workerResult)) {
    return NextResponse.json(
      { error: workerResult.error },
      { status: workerResult.status }
    );
  }

  await livePokerConvex.action(
    api.live_poker.serverApproveLivePokerBuyInRequest,
    { requestId, secret, userId: user._id }
  );
  return NextResponse.json({ ok: true });
}
