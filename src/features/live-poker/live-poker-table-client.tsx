"use client";

import { Loader2, Play, Power, Users } from "lucide-react";
import PartySocket from "partysocket";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  LivePokerClientMessage,
  LivePokerServerMessage,
  PublicLivePokerSeat,
  PublicLivePokerState,
} from "@/lib/live-poker/types";

interface LivePokerTableClientProps {
  tableId: string;
}

function chip(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function Seat({ seat }: { seat: PublicLivePokerSeat | null }) {
  if (!seat) {
    return (
      <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed bg-background/80 font-medium text-foreground text-sm">
        Open Seat
      </div>
    );
  }

  return (
    <div
      className={`min-h-28 rounded-lg border bg-background/95 p-3 shadow-sm ${
        seat.isCurrentUser ? "border-emerald-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{seat.name}</p>
          <p className="text-muted-foreground text-xs">
            Stack {chip(seat.stack)}
          </p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            seat.connected ? "bg-emerald-500" : "bg-muted"
          }`}
        />
      </div>
      <div className="mt-3 flex min-h-8 gap-1">
        {seat.cards?.map((card) => (
          <span
            className="inline-flex h-8 w-7 items-center justify-center rounded border bg-white font-semibold text-black text-xs"
            key={card}
          >
            {card}
          </span>
        ))}
        {!seat.cards && seat.hasCards ? (
          <>
            <span className="h-8 w-7 rounded border bg-zinc-900" />
            <span className="h-8 w-7 rounded border bg-zinc-900" />
          </>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {seat.bet > 0 ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
            Bet {chip(seat.bet)}
          </span>
        ) : null}
        {seat.folded ? (
          <span className="rounded bg-muted px-2 py-0.5">Folded</span>
        ) : null}
        {seat.isAllIn ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
            All in
          </span>
        ) : null}
        {seat.sitOut ? (
          <span className="rounded bg-muted px-2 py-0.5">Sitting out</span>
        ) : null}
        {seat.ready && !seat.sitOut && seat.stack > 0 ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
            Ready
          </span>
        ) : null}
      </div>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This component owns the socket lifecycle and compact v1 table controls.
export function LivePokerTableClient({ tableId }: LivePokerTableClientProps) {
  const socketRef = useRef<PartySocket | null>(null);
  const [buyIn, setBuyIn] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [raiseAmount, setRaiseAmount] = useState("");
  const [state, setState] = useState<PublicLivePokerState | null>(null);

  const send = useCallback((message: LivePokerClientMessage) => {
    socketRef.current?.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      setIsConnecting(true);
      const response = await fetch("/api/live-poker/token", {
        body: JSON.stringify({ tableId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Unable to join live table");
      }

      const body = (await response.json()) as {
        config: {
          bigBlind: number;
          createdById: string;
          maxBuyIn: number;
          minBuyIn: number;
          seatCount: number;
          smallBlind: number;
        };
        token: string;
      };

      const socket = new PartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
        party: "main",
        query: {
          bigBlind: String(body.config.bigBlind),
          hostUserId: body.config.createdById,
          maxBuyIn: String(body.config.maxBuyIn),
          minBuyIn: String(body.config.minBuyIn),
          seatCount: String(body.config.seatCount),
          smallBlind: String(body.config.smallBlind),
          token: body.token,
        },
        room: tableId,
      });

      socket.addEventListener("open", () => {
        if (!isMounted) {
          return;
        }
        setError(null);
        setIsConnecting(false);
        socket.send(JSON.stringify({ type: "joinTable" }));
      });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(
          String(event.data)
        ) as LivePokerServerMessage;
        if (message.type === "tableState") {
          setState(message.state);
          setError(null);
        }
        if (message.type === "actionRejected") {
          setError(message.message);
        }
      });

      socket.addEventListener("close", () => {
        if (isMounted) {
          setIsConnecting(true);
        }
      });

      socketRef.current = socket;
    }

    connect().catch((connectError) => {
      if (isMounted) {
        setError(
          connectError instanceof Error
            ? connectError.message
            : "Unable to connect"
        );
        setIsConnecting(false);
      }
    });

    return () => {
      isMounted = false;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [tableId]);

  const currentSeat = useMemo(
    () => state?.seats.find((seat) => seat?.isCurrentUser) ?? null,
    [state]
  );
  const callAmount =
    currentSeat && state ? state.currentBet - currentSeat.bet : 0;
  const canAct =
    Boolean(currentSeat && state?.activeSeatIndex === currentSeat.seatIndex) &&
    state?.phase !== "waiting";
  const nextStack = Number(buyIn) + (currentSeat?.stack ?? 0);
  const canAddChips =
    Boolean(currentSeat && state?.phase === "waiting") &&
    Number(buyIn) > 0 &&
    nextStack >= (state?.minBuyIn ?? 0) &&
    nextStack <= (state?.maxBuyIn ?? 0);
  const canToggleReady = Boolean(
    state?.phase === "waiting" &&
      currentSeat &&
      !currentSeat.sitOut &&
      (currentSeat.ready || currentSeat.stack > 0)
  );
  const readyPlayerCount =
    state?.seats.filter(
      (seat) => seat && !seat.sitOut && seat.ready && seat.stack > 0
    ).length ?? 0;

  function sitInSeat(seatIndex: number) {
    if (!state) {
      return;
    }
    const firstOpenSeat =
      seatIndex >= 0 ? seatIndex : state.seats.findIndex((seat) => !seat);
    if (firstOpenSeat < 0) {
      setError("No open seats");
      return;
    }
    send({
      buyIn: Number(buyIn),
      seatIndex: firstOpenSeat,
      type: "sit",
    });
  }

  if (isConnecting && !state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-h-[640px] rounded-lg bg-emerald-950 p-4 text-white">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-2xl">Live Poker</h1>
            <p className="text-emerald-100 text-sm">
              {state?.phase ?? "connecting"} · Blinds{" "}
              {state
                ? `${chip(state.smallBlind)} / ${chip(state.bigBlind)}`
                : ""}
            </p>
          </div>
          <div className="rounded bg-black/25 px-3 py-2 text-sm">
            Pot {state ? chip(state.pot) : 0}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {state?.seats.map((seat, index) => (
            <button
              className="text-left"
              key={`seat-position-${index + 1}`}
              onClick={() => (seat ? undefined : sitInSeat(index))}
              type="button"
            >
              <Seat seat={seat} />
            </button>
          ))}
        </div>

        <div className="my-8 flex min-h-24 items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/20 p-4">
          {state?.communityCards.length ? (
            state.communityCards.map((card) => (
              <span
                className="inline-flex h-14 w-10 items-center justify-center rounded border bg-white font-bold text-black"
                key={card}
              >
                {card}
              </span>
            ))
          ) : (
            <span className="text-emerald-100">Community cards</span>
          )}
        </div>

        <div className="rounded-lg bg-background p-3 text-foreground">
          {currentSeat ? (
            <div className="flex flex-wrap gap-2">
              {state?.isHost ? (
                <Button
                  disabled={state.phase !== "waiting" || readyPlayerCount < 2}
                  onClick={() => send({ type: "startHand" })}
                >
                  <Play className="h-4 w-4" />
                  Start Hand
                </Button>
              ) : null}
              <Button
                disabled={!canToggleReady}
                onClick={() =>
                  send({ ready: !currentSeat.ready, type: "ready" })
                }
                variant={currentSeat.ready ? "outline" : "default"}
              >
                <Play className="h-4 w-4" />
                {currentSeat.ready ? "Unready" : "Ready"}
              </Button>
              {state?.phase === "waiting" ? (
                <>
                  <Input
                    className="w-28"
                    min={Math.max(1, state.minBuyIn - currentSeat.stack)}
                    onChange={(event) => setBuyIn(event.target.value)}
                    placeholder="Chips"
                    type="number"
                    value={buyIn}
                  />
                  <Button
                    disabled={!canAddChips}
                    onClick={() =>
                      send({ amount: Number(buyIn), type: "addChips" })
                    }
                    variant="outline"
                  >
                    Add Chips
                  </Button>
                </>
              ) : null}
              <Button
                disabled={!canAct}
                onClick={() => send({ type: "fold" })}
                variant="outline"
              >
                Fold
              </Button>
              <Button
                disabled={!canAct || Number(callAmount) > 0}
                onClick={() => send({ type: "check" })}
                variant="outline"
              >
                Check
              </Button>
              <Button
                disabled={!canAct || Number(callAmount) <= 0}
                onClick={() => send({ type: "call" })}
              >
                Call {chip(Math.max(0, callAmount ?? 0))}
              </Button>
              <Input
                className="w-28"
                min={state?.bigBlind ?? 1}
                onChange={(event) => setRaiseAmount(event.target.value)}
                placeholder="Amount"
                type="number"
                value={raiseAmount}
              />
              <Button
                disabled={!(canAct && raiseAmount)}
                onClick={() =>
                  send({
                    amount: Number(raiseAmount),
                    type: state?.currentBet ? "raise" : "bet",
                  })
                }
                variant="outline"
              >
                {state?.currentBet ? "Raise" : "Bet"}
              </Button>
              <Button
                disabled={!canAct}
                onClick={() => send({ type: "allIn" })}
                variant="destructive"
              >
                All In
              </Button>
              <Button
                onClick={() =>
                  send({ sitOut: !currentSeat.sitOut, type: "sitOut" })
                }
                variant="ghost"
              >
                <Power className="h-4 w-4" />
                {currentSeat.sitOut ? "Return" : "Sit out"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="sm:max-w-40"
                min={state?.minBuyIn ?? 0}
                onChange={(event) => setBuyIn(event.target.value)}
                placeholder="Buy-in"
                type="number"
                value={buyIn}
              />
              <Button onClick={() => sitInSeat(-1)}>
                Sit at first open seat
              </Button>
            </div>
          )}
          {error ? (
            <p className="mt-2 text-destructive text-sm">{error}</p>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4" />
            Players
          </div>
          <div className="space-y-2">
            {state?.seats.map((seat, index) =>
              seat ? (
                <div
                  className="flex items-center justify-between rounded border p-2 text-sm"
                  key={`player-seat-${index + 1}`}
                >
                  <span>{seat.name}</span>
                  <span>{chip(seat.stack)}</span>
                </div>
              ) : null
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 font-semibold">Hand Log</div>
          <div className="max-h-80 space-y-1 overflow-auto text-muted-foreground text-sm">
            {state?.actionLog
              .map((entry, index) => ({ entry, key: `${index + 1}-${entry}` }))
              .reverse()
              .map((item) => (
                <p key={item.key}>{item.entry}</p>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
