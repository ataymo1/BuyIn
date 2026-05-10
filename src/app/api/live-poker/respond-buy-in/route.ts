import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyLivePokerBuyInRequest } from "@/lib/live-poker/apply-buy-in-request";
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
    requestId?: string;
  } | null;
  if (!body?.requestId) {
    return NextResponse.json(
      { error: "Request ID is required" },
      { status: 400 }
    );
  }

  const user = await convex.query(api.auth.getUserByEmail, {
    email: session.user.email,
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const buyInRequest = await convex.query(
    api.live_poker.getLivePokerBuyInRequestForApproval,
    {
      requestId: body.requestId as Id<"livePokerBuyInRequests">,
      userId: user._id,
    }
  );
  if (!buyInRequest) {
    return NextResponse.json(
      { error: "Pending buy-in request not found" },
      { status: 404 }
    );
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

  await convex.mutation(
    api.live_poker.approveAndMarkLivePokerBuyInRequestClaimed,
    {
      requestId: body.requestId as Id<"livePokerBuyInRequests">,
      userId: user._id,
    }
  );

  return NextResponse.json({ ok: true });
}
