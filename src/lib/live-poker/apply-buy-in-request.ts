import type { Id } from "../../../convex/_generated/dataModel";
import type { LivePokerTableConfig } from "./types";

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
  id: Id<"livePokerBuyInRequests">;
  playerId: Id<"players">;
  playerName: string;
  seatIndex?: number;
  tableId: Id<"livePokerTables">;
  table: LivePokerTableWorkerConfig;
  type: "ADD_ON" | "INITIAL";
  userId: Id<"users">;
}

function getWorkerHttpUrl(tableId: string, operation: "claim" | "close") {
  const base =
    process.env.LIVE_POKER_WORKER_URL ||
    process.env.NEXT_PUBLIC_LIVE_POKER_WORKER_URL;
  if (!base) {
    throw new Error("LIVE_POKER_WORKER_URL is not configured");
  }
  const url = new URL(
    `/live-poker/${encodeURIComponent(tableId)}/${operation}`,
    base
  );
  if (url.protocol === "ws:") {
    url.protocol = "http:";
  }
  if (url.protocol === "wss:") {
    url.protocol = "https:";
  }
  return url;
}

function getWorkerConfig(table: LivePokerTableWorkerConfig) {
  return {
    bigBlind: table.bigBlind,
    hostUserId: table.createdById,
    maxBuyIn: table.maxBuyIn,
    minBuyIn: table.minBuyIn,
    seatCount: table.seatCount,
    smallBlind: table.smallBlind,
  } satisfies LivePokerTableConfig;
}

async function postToWorker(
  tableId: string,
  operation: "claim" | "close",
  body: unknown
) {
  const secret = process.env.LIVE_POKER_CONTROL_SECRET;
  if (!secret) {
    return {
      error: "Live poker worker control secret is not configured",
      status: 500,
    };
  }

  let workerResponse: Response;
  try {
    workerResponse = await fetch(getWorkerHttpUrl(tableId, operation), {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "x-live-poker-secret": secret,
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Unable to reach live poker worker: ${error.message}`
          : "Unable to reach live poker worker",
      status: 502,
    };
  }
  if (workerResponse.ok) {
    return { ok: true as const };
  }

  const responseBody = (await workerResponse.json().catch(() => null)) as {
    error?: string;
  } | null;
  return {
    error: responseBody?.error ?? `Unable to ${operation} live poker table`,
    status: workerResponse.status,
  };
}

export async function applyLivePokerBuyInRequest(
  request: LivePokerBuyInRequestForWorker
) {
  return await postToWorker(request.tableId, "claim", {
    amount: request.amount,
    config: getWorkerConfig(request.table),
    playerId: request.playerId,
    playerName: request.playerName,
    requestId: request.id,
    seatIndex: request.seatIndex,
    type: request.type,
    userId: request.userId,
  });
}

export async function closeLivePokerTable(
  tableId: Id<"livePokerTables">,
  table: LivePokerTableWorkerConfig
) {
  return await postToWorker(tableId, "close", {
    config: getWorkerConfig(table),
  });
}
