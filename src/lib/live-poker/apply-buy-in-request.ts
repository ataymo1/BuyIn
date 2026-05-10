import type { Id } from "../../../convex/_generated/dataModel";

interface LivePokerTableWorkerConfig {
  bigBlind: number;
  createdById: string;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}

interface LivePokerBuyInRequestForWorker {
  amount: number;
  playerId: Id<"players">;
  playerName: string;
  seatIndex?: number;
  tableId: Id<"livePokerTables">;
  table: LivePokerTableWorkerConfig;
  type: "ADD_ON" | "INITIAL";
  userId: Id<"users">;
}

function getWorkerHttpUrl(tableId: string, table: LivePokerTableWorkerConfig) {
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

export async function applyLivePokerBuyInRequest(
  request: LivePokerBuyInRequestForWorker
) {
  const secret = process.env.LIVE_POKER_WEBHOOK_SECRET;
  if (!secret) {
    return {
      error: "Live poker worker secret is not configured",
      status: 500,
    };
  }

  const workerResponse = await fetch(
    getWorkerHttpUrl(request.tableId, request.table),
    {
      body: JSON.stringify({
        amount: request.amount,
        playerId: request.playerId,
        playerName: request.playerName,
        seatIndex: request.seatIndex,
        type: request.type,
        userId: request.userId,
      }),
      headers: {
        "content-type": "application/json",
        "x-live-poker-secret": secret,
      },
      method: "POST",
    }
  );

  if (workerResponse.ok) {
    return { ok: true as const };
  }

  const responseBody = (await workerResponse.json().catch(() => null)) as {
    error?: string;
  } | null;
  return {
    error: responseBody?.error ?? "Unable to apply approved buy-in",
    status: workerResponse.status,
  };
}
