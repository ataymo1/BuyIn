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
