"use client";

import { Loader2, Play, Power, Users } from "lucide-react";
import PartySocket from "partysocket";
import type { CSSProperties } from "react";
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

const tableStageStyle = {
  background:
    "radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.12), transparent 34%), linear-gradient(145deg, #18181b, #050505)",
  minHeight: 620,
} satisfies CSSProperties;

const tableVignetteStyle = {
  background:
    "radial-gradient(circle at center, transparent 42%, rgba(0, 0, 0, 0.45) 72%)",
} satisfies CSSProperties;

const tableFeltStyle = {
  backgroundColor: "#047857",
  boxShadow:
    "0 0 0 1px rgba(255, 255, 255, 0.14), 0 24px 70px rgba(0, 0, 0, 0.55), inset 0 0 0 8px rgba(255, 255, 255, 0.07), inset 0 0 45px rgba(0, 0, 0, 0.36)",
  height: 440,
} satisfies CSSProperties;

const tableFeltSurfaceStyle = {
  background:
    "radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.18), transparent 34%), linear-gradient(135deg, #10b981, #047857 62%, #065f46)",
  boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.26)",
} satisfies CSSProperties;

const tableCenterStyle = {
  maxWidth: "34rem",
  width: "78%",
} satisfies CSSProperties;

const SEAT_POSITIONS: Record<number, Array<{ x: number; y: number }>> = {
  2: [
    { x: 50, y: 88 },
    { x: 50, y: 12 },
  ],
  3: [
    { x: 50, y: 88 },
    { x: 16, y: 32 },
    { x: 84, y: 32 },
  ],
  4: [
    { x: 50, y: 88 },
    { x: 14, y: 50 },
    { x: 50, y: 12 },
    { x: 86, y: 50 },
  ],
  5: [
    { x: 50, y: 88 },
    { x: 14, y: 66 },
    { x: 22, y: 15 },
    { x: 78, y: 15 },
    { x: 86, y: 66 },
  ],
  6: [
    { x: 50, y: 88 },
    { x: 15, y: 72 },
    { x: 15, y: 28 },
    { x: 50, y: 12 },
    { x: 85, y: 28 },
    { x: 85, y: 72 },
  ],
  7: [
    { x: 50, y: 88 },
    { x: 16, y: 76 },
    { x: 14, y: 43 },
    { x: 26, y: 14 },
    { x: 74, y: 14 },
    { x: 86, y: 43 },
    { x: 84, y: 76 },
  ],
  8: [
    { x: 50, y: 88 },
    { x: 24, y: 84 },
    { x: 14, y: 64 },
    { x: 16, y: 26 },
    { x: 50, y: 12 },
    { x: 84, y: 26 },
    { x: 86, y: 64 },
    { x: 76, y: 84 },
  ],
  9: [
    { x: 50, y: 88 },
    { x: 24, y: 84 },
    { x: 14, y: 70 },
    { x: 14, y: 38 },
    { x: 30, y: 14 },
    { x: 70, y: 14 },
    { x: 86, y: 38 },
    { x: 86, y: 70 },
    { x: 76, y: 84 },
  ],
};

function chip(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function getSeatPosition(index: number, seatCount: number) {
  const positions = SEAT_POSITIONS[seatCount];
  if (positions?.[index]) {
    return positions[index];
  }

  const angle = Math.PI / 2 - (2 * Math.PI * index) / Math.max(seatCount, 1);
  return {
    x: 50 + 46 * Math.cos(angle),
    y: 50 + 52 * Math.sin(angle),
  };
}

function Seat({
  isActive,
  roles,
  seat,
  winAmount,
}: {
  isActive?: boolean;
  roles: string[];
  seat: PublicLivePokerSeat | null;
  winAmount?: number;
}) {
  if (!seat) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-white/35 border-dashed bg-zinc-950/85 px-3 font-semibold text-sm text-white shadow-lg backdrop-blur-sm transition-colors hover:border-emerald-200 hover:bg-zinc-900 sm:h-28">
        Open Seat
      </div>
    );
  }

  return (
    <div
      className={`min-h-24 rounded-lg border bg-background/95 p-2.5 text-foreground shadow-xl backdrop-blur-sm sm:min-h-28 sm:p-3 ${
        seat.isCurrentUser
          ? "border-emerald-500 ring-2 ring-emerald-300/60"
          : ""
      } ${isActive ? "border-amber-300 ring-2 ring-amber-200/70" : ""} ${
        seat.folded ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{seat.name}</p>
          <p className="text-muted-foreground text-xs">
            Stack {chip(seat.stack)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {roles.map((role) => (
            <span
              className="rounded bg-zinc-100 px-1 py-0.5 font-semibold text-xs text-zinc-700"
              key={role}
            >
              {role}
            </span>
          ))}
          <span
            className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${
              seat.connected ? "bg-emerald-500" : "bg-muted"
            }`}
          />
        </div>
      </div>
      <div className="mt-2 flex min-h-7 gap-1 sm:mt-3 sm:min-h-8">
        {seat.cards?.map((card) => (
          <span
            className="inline-flex h-7 w-6 items-center justify-center rounded border bg-white font-semibold text-black text-xs sm:h-8 sm:w-7"
            key={card}
          >
            {card}
          </span>
        ))}
        {!seat.cards && seat.hasCards ? (
          <>
            <span className="h-7 w-6 rounded border bg-zinc-900 sm:h-8 sm:w-7" />
            <span className="h-7 w-6 rounded border bg-zinc-900 sm:h-8 sm:w-7" />
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
        {winAmount ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
            Won {chip(winAmount)}
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
  const winnerAmountsBySeat = useMemo(() => {
    const amounts = new Map<number, number>();
    for (const winner of state?.lastWinners ?? []) {
      amounts.set(
        winner.seatIndex,
        (amounts.get(winner.seatIndex) ?? 0) + winner.amount
      );
    }
    return amounts;
  }, [state?.lastWinners]);
  const tableRolesBySeat = useMemo(() => {
    const roles = new Map<number, string[]>();

    function addRole(seatIndex: number | null | undefined, role: string) {
      if (seatIndex === null || seatIndex === undefined) {
        return;
      }
      roles.set(seatIndex, [...(roles.get(seatIndex) ?? []), role]);
    }

    addRole(state?.dealerSeatIndex, "D");
    addRole(state?.smallBlindSeatIndex, "SB");
    addRole(state?.bigBlindSeatIndex, "BB");
    return roles;
  }, [
    state?.bigBlindSeatIndex,
    state?.dealerSeatIndex,
    state?.smallBlindSeatIndex,
  ]);

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section
        className="rounded-lg bg-zinc-950 p-4 text-white shadow-inner xl:col-span-2"
        style={{ minHeight: 640 }}
      >
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
          <div className="rounded bg-white/10 px-3 py-2 text-sm shadow-inner">
            Pot {state ? chip(state.pot) : 0}
          </div>
        </div>

        <div
          className="relative mx-auto mb-6 max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-zinc-950 px-8 py-20 shadow-2xl sm:px-16 sm:py-24 lg:px-24"
          style={tableStageStyle}
        >
          <div className="absolute inset-0" style={tableVignetteStyle} />
          <div
            className="relative rounded-full border-8 border-zinc-800 bg-emerald-700"
            style={tableFeltStyle}
          >
            <div
              className="absolute inset-4 rounded-full border border-emerald-200/20 bg-emerald-700"
              style={tableFeltSurfaceStyle}
            />
            <div className="absolute inset-10 rounded-full border border-emerald-100/20 border-dashed" />

            <div
              className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 text-center"
              style={tableCenterStyle}
            >
              <div className="rounded-full bg-black/30 px-6 py-2 font-bold text-2xl shadow-inner">
                {state ? chip(state.pot) : 0}
              </div>
              <div className="text-emerald-50/90 text-xs uppercase tracking-widest">
                Pot · {state?.phase ?? "connecting"}
              </div>
              <div className="flex min-h-16 max-w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 py-3 shadow-inner sm:gap-2 sm:px-5">
                {state?.communityCards.length ? (
                  state.communityCards.map((card) => (
                    <span
                      className="inline-flex h-12 w-9 items-center justify-center rounded border bg-white font-bold text-black text-sm shadow-md sm:h-14 sm:w-10"
                      key={card}
                    >
                      {card}
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-50/75 text-sm">
                    Community cards
                  </span>
                )}
              </div>
            </div>
          </div>

          {state?.seats.map((seat, index) => {
            const position = getSeatPosition(index, state.seatCount);

            return (
              <button
                className="absolute w-36 -translate-x-1/2 -translate-y-1/2 text-left transition-transform hover:z-20 hover:scale-105 focus:z-20 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:w-44"
                key={`seat-position-${index + 1}`}
                onClick={() => (seat ? undefined : sitInSeat(index))}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                }}
                type="button"
              >
                <Seat
                  isActive={state.activeSeatIndex === index}
                  roles={tableRolesBySeat.get(index) ?? []}
                  seat={seat}
                  winAmount={winnerAmountsBySeat.get(index)}
                />
              </button>
            );
          })}
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
