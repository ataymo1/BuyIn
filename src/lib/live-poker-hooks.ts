"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
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

export function useLivePokerBuyInRequests(
  tableId: Id<"livePokerTables"> | undefined,
  userId: Id<"users"> | undefined
) {
  const [requests, setRequests] = useState<{
    pending: unknown[];
    user: unknown[];
  }>({ pending: [], user: [] });
  const [isLoading, setIsLoading] = useState(Boolean(tableId && userId));

  useEffect(() => {
    if (!(tableId && userId)) {
      setRequests({ pending: [], user: [] });
      setIsLoading(false);
      return;
    }

    setRequests({ pending: [], user: [] });
    setIsLoading(true);
    let active = true;
    let controller: AbortController | null = null;
    let loading = false;
    let retryDelay = 5000;
    let timer: number | null = null;

    function schedule(delay: number) {
      if (active) {
        if (timer !== null) {
          window.clearTimeout(timer);
        }
        timer = window.setTimeout(load, delay);
      }
    }

    async function load() {
      if (!active || loading) {
        return;
      }
      if (document.hidden) {
        schedule(30_000);
        return;
      }
      loading = true;
      controller = new AbortController();
      try {
        const body = await requestLivePokerApi<{
          pending: unknown[];
          user: unknown[];
        }>(
          `/api/live-poker/buy-in-requests?tableId=${encodeURIComponent(tableId as string)}`,
          {
            method: "GET",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(10_000),
            ]),
          }
        );
        if (active) {
          setRequests({ pending: body.pending, user: body.user });
          setIsLoading(false);
          retryDelay = 5000;
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setIsLoading(false);
          retryDelay = Math.min(60_000, retryDelay * 2);
        }
      } finally {
        loading = false;
        schedule(retryDelay);
      }
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
        load();
      }
    }

    load();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      controller?.abort();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tableId, userId]);

  return { isLoading, pending: requests.pending, user: requests.user };
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
