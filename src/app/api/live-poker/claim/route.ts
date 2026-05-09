import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

const convex = new ConvexHttpClient(convexUrl);

function getWorkerHttpUrl(
  tableId: string,
  table: {
    bigBlind: number;
    createdById: string;
    maxBuyIn: number;
    minBuyIn: number;
    seatCount: number;
    smallBlind: number;
  }
) {
  const base =
    process.env.LIVE_POKER_WORKER_URL ||
    process.env.NEXT_PUBLIC_LIVE_POKER_WORKER_URL ||
    "http://localhost:8787";
  const url = new URL(`/live-poker/${encodeURIComponent(tableId)}/claim`, base);
  if (url.protocol === "ws:") {
    url.protocol = "http:";
  }
  if (url.protocol === "wss:") {
    url.protocol = "https:";
  }

  url.searchParams.set("bigBlind", String(table.bigBlind));
  url.searchParams.set("hostUserId", table.createdById);
  url.searchParams.set("maxBuyIn", String(table.maxBuyIn));
  url.searchParams.set("minBuyIn", String(table.minBuyIn));
  url.searchParams.set("seatCount", String(table.seatCount));
  url.searchParams.set("smallBlind", String(table.smallBlind));
  return url;
}

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
    api.live_poker.getLivePokerBuyInRequestForClaim,
    {
      requestId: body.requestId as Id<"livePokerBuyInRequests">,
      userId: user._id,
    }
  );
  if (!buyInRequest) {
    return NextResponse.json(
      { error: "Approved buy-in request not found" },
      { status: 404 }
    );
  }

  const player = await convex.query(api.players.getPlayerByUserId, {
    userId: user._id,
  });
  if (!player || player._id !== buyInRequest.playerId) {
    return NextResponse.json(
      { error: "Player profile does not match this request" },
      { status: 403 }
    );
  }

  const secret = process.env.LIVE_POKER_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Live poker worker secret is not configured" },
      { status: 500 }
    );
  }

  const workerResponse = await fetch(
    getWorkerHttpUrl(buyInRequest.tableId, buyInRequest.table),
    {
      body: JSON.stringify({
        amount: buyInRequest.amount,
        playerId: buyInRequest.playerId,
        playerName: player.name,
        seatIndex: buyInRequest.seatIndex,
        type: buyInRequest.type,
        userId: buyInRequest.userId,
      }),
      headers: {
        "content-type": "application/json",
        "x-live-poker-secret": secret,
      },
      method: "POST",
    }
  );

  if (!workerResponse.ok) {
    const responseBody = (await workerResponse.json().catch(() => null)) as {
      error?: string;
    } | null;
    return NextResponse.json(
      { error: responseBody?.error ?? "Unable to claim approved buy-in" },
      { status: workerResponse.status }
    );
  }

  await convex.mutation(api.live_poker.markLivePokerBuyInRequestClaimed, {
    requestId: body.requestId as Id<"livePokerBuyInRequests">,
    userId: user._id,
  });

  return NextResponse.json({ ok: true });
}
