"use client";

import { useMutation, useQuery } from "convex/react";
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

export function useCreateLivePokerTable() {
  return useMutation(api.live_poker.createLivePokerTable);
}

export function useDeleteLivePokerTable() {
  return useMutation(api.live_poker.deleteLivePokerTable);
}

export function useCreateLivePokerBuyInRequest() {
  return useMutation(api.live_poker.createLivePokerBuyInRequest);
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
  return useMutation(api.live_poker.respondToLivePokerBuyInRequest);
}
