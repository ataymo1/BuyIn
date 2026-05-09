"use client";

import { CircleDollarSign, Loader2, Play, Power } from "lucide-react";
import dynamic from "next/dynamic";
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
    { x: 50, y: 87 },
    { x: 50, y: 13 },
  ],
  3: [
    { x: 50, y: 87 },
    { x: 17, y: 34 },
    { x: 83, y: 34 },
  ],
  4: [
    { x: 50, y: 87 },
    { x: 16, y: 50 },
    { x: 50, y: 13 },
    { x: 84, y: 50 },
  ],
  5: [
    { x: 50, y: 87 },
    { x: 16, y: 66 },
    { x: 24, y: 16 },
    { x: 76, y: 16 },
    { x: 84, y: 66 },
  ],
  6: [
    { x: 50, y: 87 },
    { x: 16, y: 72 },
    { x: 16, y: 30 },
    { x: 50, y: 13 },
    { x: 84, y: 30 },
    { x: 84, y: 72 },
  ],
  7: [
    { x: 50, y: 87 },
    { x: 23, y: 82 },
    { x: 16, y: 45 },
    { x: 28, y: 16 },
    { x: 72, y: 16 },
    { x: 84, y: 45 },
    { x: 77, y: 82 },
  ],
  8: [
    { x: 50, y: 87 },
    { x: 25, y: 82 },
    { x: 16, y: 64 },
    { x: 18, y: 28 },
    { x: 50, y: 13 },
    { x: 82, y: 28 },
    { x: 84, y: 64 },
    { x: 75, y: 82 },
  ],
  9: [
    { x: 50, y: 87 },
    { x: 25, y: 82 },
    { x: 16, y: 70 },
    { x: 16, y: 40 },
    { x: 31, y: 16 },
    { x: 69, y: 16 },
    { x: 84, y: 40 },
    { x: 84, y: 70 },
    { x: 75, y: 82 },
  ],
};

type SeatZone = "bottom" | "left" | "right" | "top";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSeatZone(position: { x: number; y: number }): SeatZone {
  if (position.y >= 78) {
    return "bottom";
  }
  if (position.y <= 24) {
    return "top";
  }
  return position.x < 50 ? "left" : "right";
}

function towardCenter(
  position: { x: number; y: number },
  distance: number,
  xNudge = 0,
  yNudge = 0
) {
  return {
    x: clamp(position.x + (50 - position.x) * distance + xNudge, 8, 92),
    y: clamp(position.y + (50 - position.y) * distance + yNudge, 8, 92),
  };
}

function getMarkerLayout(position: { x: number; y: number }) {
  const zone = getSeatZone(position);
  let sideNudge = 0;
  if (position.x < 50) {
    sideNudge = 2;
  } else if (position.x > 50) {
    sideNudge = -2;
  }

  if (zone === "top") {
    return {
      bet: towardCenter(position, 0.48, 0, 1),
      cards: {
        x: clamp(position.x, 8, 92),
        y: clamp(position.y - 8, 7, 92),
      },
      cardsZIndex: 18,
      zone,
    };
  }

  if (zone === "bottom") {
    return {
      bet: towardCenter(position, 0.5, 0, -3),
      cards: {
        x: clamp(position.x, 8, 92),
        y: clamp(position.y - 8, 7, 92),
      },
      cardsZIndex: 18,
      zone,
    };
  }

  return {
    bet: towardCenter(position, 0.5, sideNudge, 0),
    cards: {
      x: clamp(position.x, 8, 92),
      y: clamp(position.y - 8, 7, 92),
    },
    cardsZIndex: 18,
    zone,
  };
}

function getDealerButtonPosition(position: { x: number; y: number }) {
  const zone = getSeatZone(position);
  let horizontalSide = 1;
  if (position.x < 50) {
    horizontalSide = -1;
  } else if (position.x > 50) {
    horizontalSide = 1;
  }

  if (zone === "top") {
    return {
      x: clamp(position.x + horizontalSide * 10, 14, 86),
      y: clamp(position.y + 9, 16, 28),
    };
  }

  if (zone === "bottom") {
    return {
      x: clamp(position.x + horizontalSide * 10, 14, 86),
      y: clamp(position.y - 6, 74, 84),
    };
  }

  return {
    x: clamp(position.x + (50 - position.x) * 0.18, 10, 90),
    y: clamp(position.y + (position.y < 50 ? -8 : 8), 14, 86),
  };
}

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

function DealerButton({ position }: { position: { x: number; y: number } }) {
  return (
    <div
      className="pointer-events-none absolute z-[16] flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white font-bold text-[13px] text-zinc-900 shadow-lg ring-1 ring-black/15"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
    >
      D
    </div>
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
      <div className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950/85 px-3 py-1 font-bold text-white text-xs shadow-md ring-1 ring-white/10">
        <span className="text-zinc-300">POT:</span>
        <CircleDollarSign className="h-3.5 w-3.5 text-emerald-400" />
        <span>{chip(amount)}</span>
      </div>
      <div className="font-semibold text-[11px] text-amber-100/80 uppercase tracking-wider">
        {phase}
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
      <div className="flex h-[4.5rem] w-full items-center justify-center rounded-md border border-white/35 border-dashed bg-zinc-950/85 px-3 font-semibold text-white text-xs shadow-lg backdrop-blur-sm transition-colors hover:border-emerald-200 hover:bg-zinc-900 sm:h-20">
        Open Seat
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-16 flex-col justify-center rounded-md border bg-background/95 p-2 text-center text-foreground shadow-xl backdrop-blur-sm sm:min-h-[4.5rem] ${
        seat.isCurrentUser
          ? "border-emerald-500 ring-2 ring-emerald-300/60"
          : ""
      } ${isActive ? "border-amber-300 ring-2 ring-amber-200/70" : ""} ${
        seat.folded ? "opacity-70" : ""
      }`}
    >
      <p className="truncate font-semibold text-xs">{seat.name}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Stack {chip(seat.stack)}
      </p>
      {winAmount ? (
        <p className="mt-0.5 font-semibold text-[11px] text-amber-700">
          Won {chip(winAmount)}
        </p>
      ) : null}
    </div>
  );
}

function TableSeatMarkers({
  phase,
  position,
  seat,
}: {
  phase: PublicLivePokerState["phase"];
  position: { x: number; y: number };
  seat: PublicLivePokerSeat | null;
}) {
  if (!seat) {
    return null;
  }

  const markerLayout = getMarkerLayout(position);
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
            left: `${markerLayout.bet.x}%`,
            top: `${markerLayout.bet.y}%`,
          }}
        >
          <CurrentBetBadge action={currentStreetAction} amount={seat.bet} />
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-end justify-center"
        style={{
          left: `${markerLayout.cards.x}%`,
          top: `${markerLayout.cards.y}%`,
          zIndex: markerLayout.cardsZIndex,
        }}
      >
        {seat.cards?.map((card) => (
          <PlayingCard
            card={card}
            className="-mx-0.5 first:translate-y-1.5 last:translate-y-0"
            key={card}
            rotate={card === seat.cards?.[0] ? -7 : 7}
          />
        ))}
        {!seat.cards && seat.hasCards ? (
          <>
            <PlayingCard
              className="-mx-0.5 translate-y-1.5"
              hidden
              rotate={-7}
            />
            <PlayingCard className="-mx-0.5 translate-y-0" hidden rotate={7} />
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
              <div className="flex min-h-16 max-w-full flex-wrap items-center justify-center gap-1.5 rounded-md border border-white/5 bg-black/10 px-3 py-3 shadow-inner sm:gap-2 sm:px-5">
                {state?.communityCards.length ? (
                  state.communityCards.map((card) => (
                    <PlayingCard card={card} key={card} />
                  ))
                ) : (
                  <span className="font-medium text-emerald-50/55 text-sm">
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
            const dealerButtonPosition = getDealerButtonPosition(position);

            return (
              <div key={`seat-position-${index + 1}`}>
                {state.dealerSeatIndex === index ? (
                  <DealerButton position={dealerButtonPosition} />
                ) : null}
                <TableSeatMarkers
                  phase={state.phase}
                  position={position}
                  seat={seat}
                />
                <button
                  className="absolute z-20 w-32 -translate-x-1/2 -translate-y-1/2 text-left transition-transform hover:z-30 hover:scale-105 focus:z-30 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:w-36"
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
