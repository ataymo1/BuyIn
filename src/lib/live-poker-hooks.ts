"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useLivePokerTables(currentUserId?: Id<"users">) {
  const tables = useQuery(api.live_poker.listLivePokerTables, {
    currentUserId,
  });

  return {
    isLoading: tables === undefined,
    tables: tables ?? [],
  };
}

export function useLivePokerTable(tableId: Id<"livePokerTables"> | undefined) {
  const table = useQuery(
    api.live_poker.getLivePokerTable,
    tableId ? { tableId } : "skip"
  );

  return {
    isLoading: table === undefined && tableId !== undefined,
    table,
  };
}

async function requestLivePokerApi<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "Live poker request failed");
  }
  if (!body) {
    throw new Error("Live poker returned an empty response");
  }
  return body;
}

export function useCreateLivePokerTable() {
  return async (args: {
    bigBlind: number;
    createdById: Id<"users">;
    maxBuyIn: number;
    minBuyIn: number;
    seatCount: number;
    smallBlind: number;
    title: string;
  }) => {
    const { createdById: _createdById, ...body } = args;
    const result = await requestLivePokerApi<{ tableId: string }>(
      "/api/live-poker/tables",
      {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );
    return result.tableId;
  };
}

export function useDeleteLivePokerTable() {
  return async (args: {
    tableId: Id<"livePokerTables">;
    userId: Id<"users">;
  }) => {
    const result = await requestLivePokerApi<{ ok: boolean }>(
      `/api/live-poker/tables/${encodeURIComponent(args.tableId)}`,
      { method: "DELETE" }
    );
    return result.ok;
  };
}

export function useCreateLivePokerBuyInRequest() {
  return async (args: {
    amount: number;
    playerId: Id<"players">;
    seatIndex?: number;
    tableId: Id<"livePokerTables">;
    type: "ADD_ON" | "INITIAL";
    userId: Id<"users">;
  }) => {
    const { playerId: _playerId, userId: _userId, ...body } = args;
    const result = await requestLivePokerApi<{ requestId: string }>(
      "/api/live-poker/buy-in-requests",
      {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );
    return result.requestId;
  };
}

export function usePendingLivePokerBuyInRequests(
  tableId: Id<"livePokerTables"> | undefined,
  userId: Id<"users"> | undefined
) {
  const requests = useQuery(
    api.live_poker.getPendingLivePokerBuyInRequests,
    tableId && userId ? { tableId, userId } : "skip"
  );

  return {
    isLoading: requests === undefined && Boolean(tableId && userId),
    requests: requests ?? [],
  };
}

export function useUserLivePokerBuyInRequests(
  tableId: Id<"livePokerTables"> | undefined,
  userId: Id<"users"> | undefined
) {
  const requests = useQuery(
    api.live_poker.getUserLivePokerBuyInRequests,
    tableId && userId ? { tableId, userId } : "skip"
  );

  return {
    isLoading: requests === undefined && Boolean(tableId && userId),
    requests: requests ?? [],
  };
}

export function useRespondToLivePokerBuyInRequest() {
  return async (args: {
    requestId: Id<"livePokerBuyInRequests">;
    status: "REJECTED";
    userId: Id<"users">;
  }) => {
    const result = await requestLivePokerApi<{ ok: boolean }>(
      "/api/live-poker/respond-buy-in",
      {
        body: JSON.stringify({
          requestId: args.requestId,
          status: args.status,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );
    return result.ok;
  };
}
