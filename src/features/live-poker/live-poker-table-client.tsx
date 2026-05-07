"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  LivePokerClientMessage,
  LivePokerServerMessage,
  PublicLivePokerSeat,
  PublicLivePokerState,
} from "@/lib/live-poker/types";
import { Loader2, Play, Power } from "lucide-react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LivePokerTableClientProps {
  tableId: string;
}

const Card = dynamic(
  () => import("@heruka_urgyen/react-playing-cards/lib/FcB"),
  { ssr: false }
);

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

function getViewerSeatPosition(
  seatIndex: number,
  seatCount: number,
  viewerSeatIndex?: number
) {
  if (viewerSeatIndex === undefined) {
    return getSeatPosition(seatIndex, seatCount);
  }

  const displayIndex = (seatIndex - viewerSeatIndex + seatCount) % seatCount;
  return getSeatPosition(displayIndex, seatCount);
}

function PlayingCard({
  card,
  className = "",
  hidden,
  rotate = 0,
}: {
  card?: string;
  className?: string;
  hidden?: boolean;
  rotate?: number;
}) {
  const packageCard = card
    ? `${card.slice(0, -1)}${card.at(-1)?.toLowerCase()}`
    : undefined;

  const cardHeight = "80px";

  return (
    <span
      className={`inline-flex rounded-md shadow-lg ring-1 ring-black/20 drop-shadow-[0_8px_10px_rgba(0,0,0,0.28)] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <Card
        back={hidden || !packageCard}
        card={packageCard}
        className="block rounded-md"
        height={cardHeight}
      />
    </span>
  );
}

function streetActionLabel(
  action: NonNullable<PublicLivePokerSeat["streetAction"]>["type"]
) {
  const labels = {
    allIn: "All in",
    bet: "Bet",
    bigBlind: "BB",
    call: "Call",
    check: "Check",
    fold: "Fold",
    raise: "Raise",
    smallBlind: "SB",
  } satisfies Record<typeof action, string>;
  return labels[action];
}

function CurrentBetBadge({
  action,
  amount,
}: {
  action: NonNullable<PublicLivePokerSeat["streetAction"]>;
  amount: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950/80 px-2 py-1 font-semibold text-[11px] text-white shadow-md ring-1 ring-white/15 backdrop-blur-sm">
      <span className="text-zinc-300">{streetActionLabel(action.type)}</span>
      {chip(amount)}
    </span>
  );
}

function CenterPot({
  amount,
  phase,
}: {
  amount: number;
  phase: PublicLivePokerState["phase"] | "connecting";
}) {
  return (
    <>
      <div className="rounded-full bg-black/30 px-6 py-2 font-bold text-2xl shadow-inner">
        {chip(amount)}
      </div>
      <div className="text-emerald-50/90 text-xs uppercase tracking-widest">
        Pot · {phase}
      </div>
    </>
  );
}

function Seat({
  isActive,
  seat,
  winAmount,
}: {
  isActive?: boolean;
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
      className={`flex min-h-20 flex-col justify-center rounded-lg border bg-background/95 p-3 text-center text-foreground shadow-xl backdrop-blur-sm sm:min-h-24 ${
        seat.isCurrentUser
          ? "border-emerald-500 ring-2 ring-emerald-300/60"
          : ""
      } ${isActive ? "border-amber-300 ring-2 ring-amber-200/70" : ""} ${
        seat.folded ? "opacity-70" : ""
      }`}
    >
      <p className="truncate font-semibold text-sm">{seat.name}</p>
      <p className="mt-1 text-muted-foreground text-xs">
        Stack {chip(seat.stack)}
      </p>
      {winAmount ? (
        <p className="mt-1 font-semibold text-amber-700 text-xs">
          Won {chip(winAmount)}
        </p>
      ) : null}
    </div>
  );
}

function TableSeatMarkers({
  phase,
  position,
  roles,
  seat,
}: {
  phase: PublicLivePokerState["phase"];
  position: { x: number; y: number };
  roles: string[];
  seat: PublicLivePokerSeat | null;
}) {
  if (!seat) {
    return null;
  }

  const markerPosition = {
    x: position.x + (50 - position.x) * 0.32,
    y: position.y + (50 - position.y) * 0.32,
  };
  const betPosition = {
    x: position.x + (50 - position.x) * 0.56,
    y: position.y + (50 - position.y) * 0.56,
  };
  const rolePosition = {
    x: position.x + (50 - position.x) * 0.34,
    y: position.y + (50 - position.y) * 0.34,
  };
  const currentStreetAction = seat.streetAction;
  const showCurrentStreetBet =
    phase !== "waiting" &&
    phase !== "showdown" &&
    seat.bet > 0 &&
    Boolean(currentStreetAction);

  return (
    <>
      {showCurrentStreetBet && currentStreetAction ? (
        <div
          className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${betPosition.x}%`,
            top: `${betPosition.y}%`,
          }}
        >
          <CurrentBetBadge action={currentStreetAction} amount={seat.bet} />
        </div>
      ) : null}
      {roles.length ? (
        <div
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 gap-1"
          style={{
            left: `${rolePosition.x}%`,
            top: `${rolePosition.y}%`,
          }}
        >
          {roles.map((role) => (
            <span
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-sky-200/90 bg-sky-500 px-2 font-bold text-white text-xs shadow-md"
              key={role}
            >
              {role}
            </span>
          ))}
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-end justify-center"
        style={{
          left: `${markerPosition.x}%`,
          top: `${markerPosition.y}%`,
        }}
      >
        {seat.cards?.map((card) => (
          <PlayingCard
            card={card}
            className="-mx-0.5 first:translate-y-1 last:-translate-y-1"
            key={card}
            rotate={card === seat.cards?.[0] ? -7 : 7}
          />
        ))}
        {!seat.cards && seat.hasCards ? (
          <>
            <PlayingCard className="-mx-0.5 translate-y-1" hidden rotate={-7} />
            <PlayingCard className="-mx-0.5 -translate-y-1" hidden rotate={7} />
          </>
        ) : null}
      </div>
    </>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This component owns the socket lifecycle and compact v1 table controls.
export function LivePokerTableClient({ tableId }: LivePokerTableClientProps) {
  const socketRef = useRef<WebSocket | null>(null);
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

      const workerUrl = new URL(
        `/live-poker/${encodeURIComponent(tableId)}`,
        process.env.NEXT_PUBLIC_LIVE_POKER_WORKER_URL ?? "ws://localhost:8787"
      );
      workerUrl.searchParams.set("bigBlind", String(body.config.bigBlind));
      workerUrl.searchParams.set("hostUserId", body.config.createdById);
      workerUrl.searchParams.set("maxBuyIn", String(body.config.maxBuyIn));
      workerUrl.searchParams.set("minBuyIn", String(body.config.minBuyIn));
      workerUrl.searchParams.set("seatCount", String(body.config.seatCount));
      workerUrl.searchParams.set("smallBlind", String(body.config.smallBlind));
      workerUrl.searchParams.set("token", body.token);

      const socket = new WebSocket(workerUrl);

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

      socket.addEventListener("error", () => {
        if (isMounted) {
          setError("Unable to connect to the live table");
          setIsConnecting(false);
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
    <div>
      <section
        className="rounded-lg bg-zinc-950 p-4 text-white shadow-inner"
        style={{ minHeight: 640 }}
      >
        <div className="mb-4">
          <div>
            <h1 className="font-bold text-2xl">Live Poker</h1>
            <p className="text-emerald-100 text-sm">
              {state?.phase ?? "connecting"} · Blinds{" "}
              {state
                ? `${chip(state.smallBlind)} / ${chip(state.bigBlind)}`
                : ""}
            </p>
          </div>
        </div>

        <div
          className="relative mx-auto mb-6 max-w-7xl overflow-hidden rounded-lg border border-white/10 bg-zinc-950 px-8 py-20 shadow-2xl sm:px-16 sm:py-24 lg:px-24"
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
              <CenterPot
                amount={state?.pot ?? 0}
                phase={state?.phase ?? "connecting"}
              />
              <div className="flex min-h-16 max-w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 py-3 shadow-inner sm:gap-2 sm:px-5">
                {state?.communityCards.length ? (
                  state.communityCards.map((card) => (
                    <PlayingCard card={card} key={card} />
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
            const position = getViewerSeatPosition(
              index,
              state.seatCount,
              currentSeat?.seatIndex
            );
            const roles = tableRolesBySeat.get(index) ?? [];

            return (
              <div key={`seat-position-${index + 1}`}>
                <TableSeatMarkers
                  phase={state.phase}
                  position={position}
                  roles={roles}
                  seat={seat}
                />
                <button
                  className="absolute z-20 w-36 -translate-x-1/2 -translate-y-1/2 text-left transition-transform hover:z-30 hover:scale-105 focus:z-30 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:w-44"
                  onClick={() => (seat ? undefined : sitInSeat(index))}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                  }}
                  type="button"
                >
                  <Seat
                    isActive={state.activeSeatIndex === index}
                    seat={seat}
                    winAmount={winnerAmountsBySeat.get(index)}
                  />
                </button>
              </div>
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
    </div>
  );
}
