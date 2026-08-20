"use client";

import {
  Check,
  CircleDollarSign,
  Loader2,
  LogOut,
  Minus,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Trophy,
  UserX,
  WifiOff,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConvexUser } from "@/lib/convex-hooks";
import {
  getJitteredLivePokerReconnectDelay,
  LIVE_POKER_MAX_RECONNECT_ATTEMPTS,
} from "@/lib/live-poker/reconnect";
import {
  LIVE_POKER_ACTION_SETTLE_MS,
  LIVE_POKER_INITIAL_DEAL_MS,
  LIVE_POKER_RUNOUT_STAGE_MS,
} from "@/lib/live-poker/timing";
import type {
  LivePokerClientMessage,
  LivePokerServerMessage,
  PublicLivePokerSeat,
  PublicLivePokerState,
} from "@/lib/live-poker/types";
import {
  useCreateLivePokerBuyInRequest,
  useLivePokerBuyInRequests,
  useRespondToLivePokerBuyInRequest,
} from "@/lib/live-poker-hooks";
import type { Id } from "../../../convex/_generated/dataModel";

interface LivePokerTableClientProps {
  tableId: string;
}

type ConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "reconnecting";

const Card = dynamic(
  () => import("@heruka_urgyen/react-playing-cards/lib/FcB"),
  { ssr: false }
);

const tableStageStyle = {
  background:
    "radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.12), transparent 34%), linear-gradient(145deg, #18181b, #050505)",
} satisfies CSSProperties;

const tableVignetteStyle = {
  background:
    "radial-gradient(circle at center, transparent 42%, rgba(0, 0, 0, 0.45) 72%)",
} satisfies CSSProperties;

const tableFeltStyle = {
  backgroundColor: "#047857",
  boxShadow:
    "0 0 0 1px rgba(255, 255, 255, 0.14), 0 24px 70px rgba(0, 0, 0, 0.55), inset 0 0 0 8px rgba(255, 255, 255, 0.07), inset 0 0 45px rgba(0, 0, 0, 0.36)",
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
      blind: towardCenter(position, 0.2, sideNudge, 1),
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
      blind: towardCenter(position, 0.2, sideNudge, -1),
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
    blind: towardCenter(position, 0.2, sideNudge, 0),
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

function tableControlLabel(state: PublicLivePokerState) {
  if (!state.gamePaused) {
    return state.phase === "waiting" ? "Pause table" : "Pause after hand";
  }
  return state.handNumber === 0 ? "Start table" : "Resume table";
}

function connectionLabel(
  status: ConnectionStatus,
  attempt: number,
  detailed = false
) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return detailed ? "Connecting to the live table…" : "Connecting";
    case "disconnected":
      return detailed ? "Live table disconnected" : "Disconnected";
    case "reconnecting":
      return detailed
        ? `Reconnecting to the live table (attempt ${attempt} of ${LIVE_POKER_MAX_RECONNECT_ATTEMPTS})…`
        : `Reconnecting (${attempt}/${LIVE_POKER_MAX_RECONNECT_ATTEMPTS})`;
    default:
      return "Disconnected";
  }
}

function getBetTargetBounds(
  state: PublicLivePokerState,
  seat: PublicLivePokerSeat
) {
  const maxTarget = seat.bet + seat.stack;
  const minRaiseTarget =
    state.currentBet === 0 ? state.bigBlind : state.currentBet + state.minRaise;

  return {
    maxTarget,
    minTarget: Math.min(minRaiseTarget, maxTarget),
  };
}

function getBetPresets(state: PublicLivePokerState, seat: PublicLivePokerSeat) {
  const { maxTarget, minTarget } = getBetTargetBounds(state, seat);
  const toTarget = (value: number) =>
    clamp(Math.round(value * 100) / 100, minTarget, maxTarget);
  if (state.phase === "preflop") {
    return [2, 2.5, 3].map((blinds) => ({
      label: `${blinds} BB`,
      target: toTarget(state.bigBlind * blinds),
    }));
  }

  const callAmount = Math.max(0, state.currentBet - seat.bet);
  const potAfterCall = state.pot + callAmount;
  return [
    { fraction: 1 / 3, label: "⅓ Pot" },
    { fraction: 1 / 2, label: "½ Pot" },
    { fraction: 3 / 4, label: "¾ Pot" },
    { fraction: 1, label: "Pot" },
  ].map(({ fraction, label }) => ({
    label,
    target: toTarget(seat.bet + callAmount + potAfterCall * fraction),
  }));
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

function visibleCommunityCardCount(
  state: PublicLivePokerState,
  serverNow: number
) {
  const total = state.communityCards.length;
  const revealStart = state.communityCardRevealStartIndex;
  if (revealStart === null || !state.transitionDeadlineAt) {
    return total;
  }

  const transitionDuration =
    state.transition === "runout"
      ? LIVE_POKER_RUNOUT_STAGE_MS
      : LIVE_POKER_ACTION_SETTLE_MS;
  if (state.transition !== "actionSettle" && state.transition !== "runout") {
    return total;
  }

  const elapsed = transitionDuration - (state.transitionDeadlineAt - serverNow);
  const revealCount = total - revealStart;
  if (elapsed < 100) {
    return revealStart;
  }
  if (revealCount === 3) {
    return revealStart + Math.min(3, 1 + Math.floor((elapsed - 100) / 190));
  }
  return elapsed < 140 ? revealStart : total;
}

function PlayingCard({
  animationDelayMs,
  card,
  className = "",
  hidden,
  rotate = 0,
}: {
  animationDelayMs?: number;
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
      className={`inline-flex rounded-md shadow-lg ring-1 ring-black/20 drop-shadow-[0_8px_10px_rgba(0,0,0,0.28)] ${
        animationDelayMs === undefined ? "" : "live-poker-card-deal"
      } ${className}`}
      style={
        {
          animationDelay:
            animationDelayMs === undefined
              ? undefined
              : `${animationDelayMs}ms`,
          transform: `rotate(${rotate}deg)`,
        } as CSSProperties
      }
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
      {amount > 0 ? chip(amount) : null}
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

function NextHandIntermission({
  serverNow,
  state,
}: {
  serverNow: number;
  state: PublicLivePokerState;
}) {
  if (state.transition !== "nextHand" || !state.transitionDeadlineAt) {
    return null;
  }

  const seconds = Math.max(
    1,
    Math.ceil((state.transitionDeadlineAt - serverNow) / 1000)
  );
  return (
    <output
      aria-live="polite"
      className="rounded-xl border border-amber-200/20 bg-zinc-950/90 px-5 py-2 text-white shadow-xl ring-1 ring-black/30 backdrop-blur-sm"
    >
      <span className="block font-semibold text-[10px] text-amber-200 uppercase tracking-[0.2em]">
        {state.handNumber === 0 ? "Game starts in" : "Next hand"}
      </span>
      <span className="font-black text-2xl tabular-nums">{seconds}</span>
    </output>
  );
}

function WinnerAnnouncement({ state }: { state: PublicLivePokerState }) {
  if (state.phase !== "showdown" || state.lastWinners.length === 0) {
    return null;
  }

  const seatIndexes = [
    ...new Set(state.lastWinners.map((winner) => winner.seatIndex)),
  ];
  const names = seatIndexes.map(
    (seatIndex) => state.seats[seatIndex]?.name ?? `Seat ${seatIndex + 1}`
  );
  const amount = state.lastWinners.reduce(
    (total, winner) => total + winner.amount,
    0
  );
  const descriptions = [
    ...new Set(
      state.lastWinners
        .map((winner) => winner.description)
        .filter((description): description is string => Boolean(description))
    ),
  ];

  return (
    <output
      aria-live="assertive"
      className="live-poker-winner-announcement pointer-events-none flex max-w-72 items-center gap-3 rounded-xl border border-amber-200/50 bg-zinc-950/95 px-4 py-3 text-left text-white shadow-[0_0_40px_rgba(251,191,36,0.35)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-amber-400/30 shadow-lg">
        <Trophy aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-amber-300 text-sm">
          {names.join(" & ")} {names.length > 1 ? "split the pot" : "wins"}
        </span>
        <span className="block font-black text-xl tabular-nums">
          {chip(amount)}
        </span>
        {descriptions.length > 0 ? (
          <span className="block truncate text-[11px] text-zinc-300">
            {descriptions.join(" · ")}
          </span>
        ) : null}
      </span>
    </output>
  );
}

function timerBarColor(isTimeBank: boolean, progress: number) {
  if (isTimeBank) {
    return "bg-amber-400";
  }
  return progress <= 25 ? "bg-red-500" : "bg-emerald-500";
}

function Seat({
  isActive,
  isTimeBank,
  seat,
  turnProgress,
  winAmount,
}: {
  isActive?: boolean;
  isTimeBank?: boolean;
  seat: PublicLivePokerSeat | null;
  turnProgress?: number;
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
      className={`relative flex min-h-16 flex-col justify-center overflow-hidden rounded-md border bg-background/95 px-2 py-2 text-center text-foreground shadow-xl backdrop-blur-sm sm:min-h-[4.5rem] ${
        seat.isCurrentUser
          ? "border-emerald-500 ring-2 ring-emerald-300/60"
          : ""
      } ${isActive ? "border-amber-300 ring-2 ring-amber-200/70" : ""} ${
        winAmount !== undefined
          ? "live-poker-winner-seat border-amber-300 ring-2 ring-amber-300"
          : ""
      } ${seat.folded ? "opacity-70" : ""}`}
    >
      <p className="truncate font-semibold text-xs">{seat.name}</p>
      <p className="mt-0.5 truncate font-bold text-base tabular-nums sm:text-lg">
        {chip(seat.stack)}
      </p>
      {seat.connected ? null : (
        <p className="mt-0.5 flex items-center justify-center gap-1 font-medium text-[10px] text-red-600">
          <WifiOff aria-hidden="true" className="h-3 w-3" />
          Disconnected
        </p>
      )}
      {winAmount !== undefined ? (
        <p className="live-poker-winner-badge mt-1 rounded-full bg-amber-400 px-2 py-0.5 font-black text-[10px] text-zinc-950 uppercase tracking-wide">
          Winner · +{chip(winAmount)}
        </p>
      ) : null}
      {turnProgress !== undefined ? (
        <div
          aria-label={`${seat.name} action time remaining`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(turnProgress)}
          className="absolute inset-x-0 bottom-0 h-1.5 bg-zinc-300/60"
          role="progressbar"
        >
          <div
            className={`h-full origin-left transition-[width,background-color] duration-200 ease-linear ${timerBarColor(
              Boolean(isTimeBank),
              turnProgress
            )}`}
            style={{ width: `${turnProgress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function TableSeatMarkers({
  dealElapsedMs,
  dealOrder,
  dealtSeatCount,
  phase,
  position,
  seat,
  settledAction,
}: {
  dealElapsedMs?: number;
  dealOrder?: number;
  dealtSeatCount: number;
  phase: PublicLivePokerState["phase"];
  position: { x: number; y: number };
  seat: PublicLivePokerSeat | null;
  settledAction: PublicLivePokerState["settledAction"];
}) {
  if (!seat) {
    return null;
  }

  const markerLayout = getMarkerLayout(position);
  const settlingAction =
    settledAction?.seatIndex === seat.seatIndex ? settledAction : null;
  const currentStreetAction = settlingAction ?? seat.streetAction;
  const displayedAmount = settlingAction?.amount ?? seat.bet;
  const showCurrentStreetBet =
    Boolean(settlingAction) ||
    (phase !== "waiting" &&
      phase !== "showdown" &&
      seat.bet > 0 &&
      Boolean(currentStreetAction));
  const isBlind =
    currentStreetAction?.type === "smallBlind" ||
    currentStreetAction?.type === "bigBlind";
  const badgePosition = isBlind ? markerLayout.blind : markerLayout.bet;

  return (
    <>
      {showCurrentStreetBet && currentStreetAction ? (
        <div
          className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${badgePosition.x}%`,
            top: `${badgePosition.y}%`,
          }}
        >
          <CurrentBetBadge
            action={currentStreetAction}
            amount={displayedAmount}
          />
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
        {seat.cards?.map((card, cardIndex) => (
          <PlayingCard
            animationDelayMs={
              dealElapsedMs === undefined || dealOrder === undefined
                ? undefined
                : 100 +
                  (dealOrder + cardIndex * dealtSeatCount) * 95 -
                  dealElapsedMs
            }
            card={card}
            className="-mx-0.5 first:translate-y-1.5 last:translate-y-0"
            key={card}
            rotate={cardIndex === 0 ? -7 : 7}
          />
        ))}
        {!seat.cards && seat.hasCards
          ? [0, 1].map((cardIndex) => (
              <PlayingCard
                animationDelayMs={
                  dealElapsedMs === undefined || dealOrder === undefined
                    ? undefined
                    : 100 +
                      (dealOrder + cardIndex * dealtSeatCount) * 95 -
                      dealElapsedMs
                }
                className={`-mx-0.5 ${
                  cardIndex === 0 ? "translate-y-1.5" : "translate-y-0"
                }`}
                hidden
                key={cardIndex}
                rotate={cardIndex === 0 ? -7 : 7}
              />
            ))
          : null}
      </div>
    </>
  );
}

function BettingControlsOverlay({
  amount,
  callAmount,
  currentSeat,
  disabled,
  onAmountChange,
  onSend,
  state,
}: {
  amount: number;
  callAmount: number;
  currentSeat: PublicLivePokerSeat;
  disabled: boolean;
  onAmountChange: (amount: number) => void;
  onSend: (message: LivePokerClientMessage) => void;
  state: PublicLivePokerState;
}) {
  const { maxTarget, minTarget } = getBetTargetBounds(state, currentSeat);
  const step = Math.max(0.01, state.bigBlind || 0.01);
  const hasCallAmount = callAmount > 0;
  const clampedAmount = clamp(amount, minTarget, maxTarget);
  const actionLabel = state.currentBet > 0 ? "Raise" : "Bet";
  const activeSeat =
    state.activeSeatIndex === null ? null : state.seats[state.activeSeatIndex];
  let status = activeSeat ? `Waiting for ${activeSeat.name}` : "Waiting";
  if (!disabled) {
    status = "Your turn";
  } else if (state.transition === "deal") {
    status = "Dealing cards";
  } else if (state.phase === "showdown") {
    status = "Hand complete";
  }

  function setTarget(nextAmount: number) {
    onAmountChange(
      clamp(Math.round(nextAmount * 100) / 100, minTarget, maxTarget)
    );
  }

  function submitBetOrRaise() {
    if (clampedAmount >= maxTarget) {
      onSend({ type: "allIn" });
      return;
    }

    onSend({
      amount: clampedAmount,
      type: state.currentBet > 0 ? "raise" : "bet",
    });
  }

  const presets = getBetPresets(state, currentSeat);

  return (
    <div className="absolute right-0 bottom-[-13.5rem] left-0 z-40 flex justify-center px-1 sm:right-6 sm:left-6 sm:px-0 md:bottom-[-8rem]">
      <div
        aria-disabled={disabled}
        className={`w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[opacity,filter] ${
          disabled ? "opacity-55 saturate-50" : ""
        }`}
      >
        <div className="flex items-center justify-between border-white/10 border-b px-3 py-1.5">
          <span className="font-semibold text-[10px] text-zinc-400 uppercase tracking-[0.16em]">
            Betting controls
          </span>
          <span className="font-semibold text-xs text-zinc-300">{status}</span>
        </div>
        <div className="grid gap-2 border-white/10 border-b p-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="Decrease bet"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:hover:bg-white/8"
              disabled={disabled}
              onClick={() => setTarget(clampedAmount - step)}
              type="button"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              aria-label="Bet amount"
              className="h-2 min-w-0 flex-1 cursor-pointer accent-amber-400"
              disabled={disabled}
              max={maxTarget}
              min={minTarget}
              onChange={(event) => setTarget(Number(event.target.value))}
              step={step}
              type="range"
              value={clampedAmount}
            />
            <button
              aria-label="Increase bet"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:hover:bg-white/8"
              disabled={disabled}
              onClick={() => setTarget(clampedAmount + step)}
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="min-w-20 text-right">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                {actionLabel} to
              </p>
              <p className="font-bold text-base tabular-nums">
                {chip(clampedAmount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 overflow-hidden rounded-lg bg-white/5 p-1 ring-1 ring-white/10">
            {presets.map((preset) => (
              <button
                className="h-8 rounded-md px-2 font-semibold text-xs text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                disabled={disabled}
                key={preset.label}
                onClick={() => setTarget(preset.target)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
            {state.phase === "preflop" ? (
              <button
                className="h-8 rounded-md px-2 font-semibold text-amber-300 text-xs transition-colors hover:bg-amber-400/10"
                disabled={disabled}
                onClick={() => setTarget(maxTarget)}
                type="button"
              >
                All in
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-2.5 md:p-3">
          <Button
            className="h-12 rounded-xl border-red-400/25 bg-red-500/10 font-bold text-red-200 text-sm hover:bg-red-500/20 md:h-14 md:text-base"
            disabled={disabled}
            onClick={() => onSend({ type: "fold" })}
            type="button"
            variant="outline"
          >
            Fold
          </Button>
          <Button
            className="h-12 rounded-xl border-sky-300/20 bg-sky-500/90 font-bold text-sm text-white hover:bg-sky-400 md:h-14 md:text-base"
            disabled={disabled}
            onClick={() =>
              onSend(hasCallAmount ? { type: "call" } : { type: "check" })
            }
            type="button"
          >
            {hasCallAmount ? `Call ${chip(callAmount)}` : "Check"}
          </Button>
          <Button
            className="h-12 rounded-xl bg-amber-400 font-bold text-sm text-zinc-950 hover:bg-amber-300 md:h-14 md:text-base"
            disabled={disabled || maxTarget <= 0}
            onClick={submitBetOrRaise}
            type="button"
          >
            {clampedAmount >= maxTarget ? "All in" : actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LivePokerBuyInRequestRow {
  _id: string;
  amount: number;
  id?: string;
  player?: { name?: string };
  requestedAt: number;
  seatIndex?: number;
  status: "APPROVED" | "CLAIMED" | "PENDING" | "REJECTED";
  type: "ADD_ON" | "INITIAL";
}

function requestTypeLabel(type: LivePokerBuyInRequestRow["type"]) {
  return type === "INITIAL" ? "Buy-in" : "Add-on";
}

function PendingBuyInRequestsPanel({
  approvingId,
  disabled,
  onApprove,
  onReject,
  rejectingId,
  requests,
}: {
  approvingId: string | null;
  disabled: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  rejectingId: string | null;
  requests: LivePokerBuyInRequestRow[];
}) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-white/10 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-sm">Join requests</h2>
          <p className="text-[11px] text-zinc-400">Waiting for your approval</p>
        </div>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-1.5 font-bold text-[11px] text-zinc-950">
          {requests.length}
        </span>
      </div>
      <div className="max-h-48 divide-y divide-white/10 overflow-y-auto">
        {requests.map((request) => (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            key={request._id}
          >
            <div className="min-w-0 text-left">
              <p className="truncate font-semibold text-sm">
                {request.player?.name ?? "Player"}
              </p>
              <p className="text-xs text-zinc-400">
                {requestTypeLabel(request.type)} · {chip(request.amount)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                aria-label={`Reject ${request.player?.name ?? "player"}`}
                className="h-8 w-8 border-white/15 bg-white/5 p-0 text-zinc-300 hover:bg-red-500/20 hover:text-red-300"
                disabled={
                  disabled || approvingId !== null || rejectingId !== null
                }
                onClick={() => onReject(request._id)}
                size="icon"
                variant="outline"
              >
                {rejectingId === request._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
              <Button
                aria-label={`Approve ${request.player?.name ?? "player"}`}
                className="h-8 w-8 bg-emerald-500 p-0 text-zinc-950 hover:bg-emerald-400"
                disabled={
                  disabled || approvingId !== null || rejectingId !== null
                }
                onClick={() => onApprove(request._id)}
                size="icon"
              >
                {approvingId === request._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserBuyInRequestStatus({
  requests,
}: {
  requests: LivePokerBuyInRequestRow[];
}) {
  const visibleRequests = requests.slice(0, 3);
  if (visibleRequests.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
      {visibleRequests.map((request) => (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          key={request._id}
        >
          <span>
            {requestTypeLabel(request.type)} for {chip(request.amount)} is{" "}
            <strong>{request.status.toLowerCase()}</strong>
            {request.seatIndex !== undefined
              ? ` for seat ${request.seatIndex + 1}`
              : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This component owns the socket lifecycle and compact v1 table controls.
export function LivePokerTableClient({ tableId }: LivePokerTableClientProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const socketLifecycleRef = useRef(0);
  const approvalInFlightRef = useRef(false);
  const tableIdRef = useRef(tableId);
  tableIdRef.current = tableId;
  const { userId } = useConvexUser();
  const tableConvexId = tableId as Id<"livePokerTables">;
  const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
  const [buyIn, setBuyIn] = useState("100");
  const [betTargetAmount, setBetTargetAmount] = useState(0);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null
  );
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [isRequestingBuyIn, setIsRequestingBuyIn] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [kickingSeatIndex, setKickingSeatIndex] = useState<number | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [stateSnapshot, setStateSnapshot] = useState<{
    receivedAt: number;
    state: PublicLivePokerState;
    tableId: string;
  } | null>(null);
  const state = stateSnapshot?.tableId === tableId ? stateSnapshot.state : null;
  const createBuyInRequest = useCreateLivePokerBuyInRequest();
  const respondToBuyInRequest = useRespondToLivePokerBuyInRequest();
  const { pending: pendingBuyInRequests, user: userBuyInRequests } =
    useLivePokerBuyInRequests(tableConvexId, userId);

  const send = useCallback((message: LivePokerClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError(
        "The table is disconnected. Wait for it to reconnect and try again."
      );
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    const nextTableId = tableId;
    setStateSnapshot(null);
    setPlayerId(null);
    setBetTargetAmount(0);
    setApprovingRequestId(null);
    setRejectingRequestId(null);
    setKickingSeatIndex(null);
    setIsRequestingBuyIn(false);
    setError(nextTableId ? null : "A table ID is required.");
    approvalInFlightRef.current = false;
  }, [tableId]);

  useEffect(() => {
    let active = true;
    let reconnectAttempt = 0;
    let reconnectResetTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let tokenController: AbortController | null = null;
    let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const lifecycle = socketLifecycleRef.current + retryNonce + 1;
    socketLifecycleRef.current = lifecycle;

    function isCurrentLifecycle() {
      return active && socketLifecycleRef.current === lifecycle;
    }

    function scheduleReconnect(message: string) {
      if (!isCurrentLifecycle()) {
        return;
      }
      if (reconnectAttempt >= LIVE_POKER_MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus("disconnected");
        setError(
          `${message} Automatic reconnect stopped after ${LIVE_POKER_MAX_RECONNECT_ATTEMPTS} attempts.`
        );
        return;
      }

      const delay = getJitteredLivePokerReconnectDelay(reconnectAttempt);
      reconnectAttempt += 1;
      setConnectionAttempt(reconnectAttempt);
      setConnectionStatus("reconnecting");
      reconnectTimer = setTimeout(connect, delay);
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The socket setup keeps fetch, WebSocket, and stale-lifecycle guards together.
    async function connect() {
      if (!isCurrentLifecycle()) {
        return;
      }
      if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
        tokenRefreshTimer = null;
      }

      setConnectionStatus(
        reconnectAttempt === 0 ? "connecting" : "reconnecting"
      );
      tokenController = new AbortController();

      try {
        const response = await fetch("/api/live-poker/token", {
          body: JSON.stringify({ tableId }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: tokenController.signal,
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errorBody?.error ?? "Unable to join live table");
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
          expiresAt: number;
          player: {
            id: Id<"players">;
            name: string;
          };
          token: string;
        };

        if (!isCurrentLifecycle()) {
          return;
        }
        setPlayerId(body.player.id);

        const workerBaseUrl = process.env.NEXT_PUBLIC_LIVE_POKER_WORKER_URL;
        if (!workerBaseUrl) {
          throw new Error("The live poker worker URL is not configured");
        }
        const workerUrl = new URL(
          `/live-poker/${encodeURIComponent(tableId)}`,
          workerBaseUrl
        );

        const socket = new WebSocket(workerUrl, [
          "buyin-live-poker",
          `buyin-auth-${body.token}`,
        ]);
        socketRef.current = socket;

        function isCurrentSocket() {
          return isCurrentLifecycle() && socketRef.current === socket;
        }

        tokenRefreshTimer = setTimeout(
          () => {
            if (!isCurrentSocket()) {
              return;
            }
            socketRef.current = null;
            socket.close(4001, "Refreshing credentials");
            setConnectionStatus("reconnecting");
            connect();
          },
          Math.max(1000, body.expiresAt - Date.now() - 30_000)
        );

        socket.addEventListener("open", () => {
          if (!isCurrentSocket()) {
            socket.close();
            return;
          }
          setConnectionAttempt(0);
          setConnectionStatus("connected");
          setError(null);
          reconnectResetTimer = setTimeout(() => {
            if (isCurrentSocket()) {
              reconnectAttempt = 0;
            }
          }, 30_000);
        });

        socket.addEventListener("message", (event) => {
          if (!isCurrentSocket()) {
            return;
          }
          try {
            const message = JSON.parse(
              String(event.data)
            ) as LivePokerServerMessage;
            if (message.type === "tableState") {
              const receivedAt = Date.now();
              setClockNow(receivedAt);
              setStateSnapshot({
                receivedAt,
                state: message.state,
                tableId,
              });
            } else if (message.type === "actionRejected") {
              setError(message.message);
            }
          } catch {
            setError("The live table sent an unreadable update.");
          }
        });

        socket.addEventListener("close", () => {
          if (!isCurrentSocket()) {
            return;
          }
          if (reconnectResetTimer) {
            clearTimeout(reconnectResetTimer);
            reconnectResetTimer = null;
          }
          socketRef.current = null;
          scheduleReconnect("Connection to the live table was lost.");
        });

        socket.addEventListener("error", () => {
          if (!isCurrentSocket()) {
            return;
          }
          setError("Unable to connect to the live table. Retrying…");
          socket.close();
        });
      } catch (connectError) {
        if (
          !isCurrentLifecycle() ||
          (connectError instanceof DOMException &&
            connectError.name === "AbortError")
        ) {
          return;
        }
        const message =
          connectError instanceof Error
            ? connectError.message
            : "Unable to connect to the live table.";
        setError(message);
        scheduleReconnect(message);
      }
    }

    setConnectionAttempt(0);
    setConnectionStatus("connecting");
    connect();

    return () => {
      active = false;
      socketLifecycleRef.current += 1;
      tokenController?.abort();
      if (reconnectResetTimer) {
        clearTimeout(reconnectResetTimer);
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
      }
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, [retryNonce, tableId]);

  const serverClockNow = state
    ? state.serverTimeAt + (clockNow - (stateSnapshot?.receivedAt ?? clockNow))
    : clockNow;
  const currentSeat = useMemo(
    () => state?.seats.find((seat) => seat?.isCurrentUser) ?? null,
    [state]
  );
  const isConnected = connectionStatus === "connected";
  const numericBuyIn = Number(buyIn);
  const hasFiniteBuyIn = Number.isFinite(numericBuyIn);
  const callAmount =
    currentSeat && state ? state.currentBet - currentSeat.bet : 0;
  const canAct =
    isConnected &&
    Boolean(currentSeat && state?.activeSeatIndex === currentSeat.seatIndex) &&
    state?.phase !== "waiting" &&
    !state?.transition &&
    Boolean(state?.turnDeadlineAt && state.turnDeadlineAt > serverClockNow);
  const betTargetBounds =
    state && currentSeat ? getBetTargetBounds(state, currentSeat) : null;
  const betTargetMin = betTargetBounds?.minTarget ?? 0;
  const betTargetResetKey = [
    currentSeat?.bet,
    currentSeat?.seatIndex,
    currentSeat?.stack,
    state?.activeSeatIndex,
    state?.bigBlind,
    state?.currentBet,
    state?.handNumber,
    state?.minRaise,
    state?.phase,
  ].join(":");
  const canRequestAddOn =
    isConnected &&
    Boolean(currentSeat && state?.phase === "waiting") &&
    hasFiniteBuyIn &&
    numericBuyIn > 0 &&
    numericBuyIn <= (state?.maxBuyIn ?? Number.POSITIVE_INFINITY) &&
    !isRequestingBuyIn;
  const canRequestInitialBuyIn =
    isConnected &&
    Boolean(!currentSeat && state?.phase === "waiting") &&
    hasFiniteBuyIn &&
    numericBuyIn >= (state?.minBuyIn ?? 0) &&
    numericBuyIn <= (state?.maxBuyIn ?? 0) &&
    !isRequestingBuyIn;
  const disconnectedEligiblePlayerCount =
    state?.seats.filter(
      (seat) => seat && !seat.connected && !seat.sitOut && seat.stack > 0
    ).length ?? 0;
  const kickCandidate =
    kickingSeatIndex === null ? null : (state?.seats[kickingSeatIndex] ?? null);
  const dealSequence = useMemo(() => {
    const orderBySeat = new Map<number, number>();
    if (!state || state.dealerSeatIndex === null) {
      return { count: 0, orderBySeat };
    }

    for (let offset = 1; offset <= state.seatCount; offset += 1) {
      const seatIndex = (state.dealerSeatIndex + offset) % state.seatCount;
      if (state.seats[seatIndex]?.hasCards) {
        orderBySeat.set(seatIndex, orderBySeat.size);
      }
    }
    return { count: orderBySeat.size, orderBySeat };
  }, [state]);
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
  const typedPendingBuyInRequests =
    pendingBuyInRequests as LivePokerBuyInRequestRow[];
  const typedUserBuyInRequests =
    userBuyInRequests as LivePokerBuyInRequestRow[];

  useEffect(() => {
    const deadline = state?.transitionDeadlineAt ?? state?.turnDeadlineAt;
    if (!deadline) {
      return;
    }
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state?.transitionDeadlineAt, state?.turnDeadlineAt]);

  useEffect(() => {
    if (!(canAct && betTargetResetKey)) {
      return;
    }

    setBetTargetAmount(betTargetMin);
  }, [betTargetMin, betTargetResetKey, canAct]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Validation and stale-table guards keep the request atomic.
  async function requestInitialBuyIn(seatIndex: number) {
    const requestTableId = tableId;
    if (!(state && userId && playerId)) {
      setError("Sign in with a player profile before requesting a seat");
      return;
    }
    const firstOpenSeat =
      seatIndex >= 0 ? seatIndex : state.seats.findIndex((seat) => !seat);
    if (firstOpenSeat < 0) {
      setError("No open seats");
      return;
    }
    if (!canRequestInitialBuyIn) {
      setError(
        `Buy-in must be between ${state.minBuyIn} and ${state.maxBuyIn}`
      );
      return;
    }

    setIsRequestingBuyIn(true);
    setError(null);
    try {
      const requestId = await createBuyInRequest({
        amount: numericBuyIn,
        playerId,
        seatIndex: firstOpenSeat,
        tableId: tableConvexId,
        type: "INITIAL",
        userId,
      });
      if (state.isHost && tableIdRef.current === requestTableId) {
        await approveBuyInRequest(String(requestId));
      }
    } catch (requestError) {
      if (tableIdRef.current === requestTableId) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to request buy-in"
        );
      }
    } finally {
      if (tableIdRef.current === requestTableId) {
        setIsRequestingBuyIn(false);
      }
    }
  }

  async function requestAddOn() {
    const requestTableId = tableId;
    if (!(userId && playerId && currentSeat)) {
      setError("Take a seat before requesting chips");
      return;
    }
    if (!canRequestAddOn) {
      setError("Enter a valid chip amount");
      return;
    }

    setIsRequestingBuyIn(true);
    setError(null);
    try {
      const requestId = await createBuyInRequest({
        amount: numericBuyIn,
        playerId,
        tableId: tableConvexId,
        type: "ADD_ON",
        userId,
      });
      if (state?.isHost && tableIdRef.current === requestTableId) {
        await approveBuyInRequest(String(requestId));
      }
    } catch (requestError) {
      if (tableIdRef.current === requestTableId) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to request chips"
        );
      }
    } finally {
      if (tableIdRef.current === requestTableId) {
        setIsRequestingBuyIn(false);
      }
    }
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Approval locking and stale-table guards prevent duplicate side effects.
  async function approveBuyInRequest(requestId: string) {
    const requestTableId = tableId;
    if (approvalInFlightRef.current) {
      return;
    }
    if (!isConnected) {
      setError("Reconnect before approving a buy-in request.");
      return;
    }

    approvalInFlightRef.current = true;
    setApprovingRequestId(requestId);
    setError(null);
    try {
      const response = await fetch("/api/live-poker/respond-buy-in", {
        body: JSON.stringify({ requestId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Unable to approve buy-in request");
      }
      if (tableIdRef.current === requestTableId) {
        send({ type: "requestSync" });
      }
    } catch (requestError) {
      if (tableIdRef.current === requestTableId) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to approve buy-in request"
        );
      }
    } finally {
      if (tableIdRef.current === requestTableId) {
        approvalInFlightRef.current = false;
        setApprovingRequestId(null);
      }
    }
  }

  async function rejectBuyInRequest(requestId: string) {
    const requestTableId = tableId;
    if (!userId) {
      return;
    }
    setRejectingRequestId(requestId);
    setError(null);
    try {
      await respondToBuyInRequest({
        requestId: requestId as Id<"livePokerBuyInRequests">,
        status: "REJECTED",
        userId,
      });
    } catch (requestError) {
      if (tableIdRef.current === requestTableId) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to reject buy-in request"
        );
      }
    } finally {
      if (tableIdRef.current === requestTableId) {
        setRejectingRequestId(null);
      }
    }
  }

  function kickSeat(seatIndex: number) {
    setKickingSeatIndex(null);
    send({ seatIndex, type: "kickSeat" });
  }

  if (!state) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center p-4 text-center">
        <div aria-live="polite" className="space-y-3">
          {connectionStatus !== "disconnected" ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <WifiOff className="mx-auto h-8 w-8 text-destructive" />
          )}
          <p className="font-medium">
            {connectionLabel(connectionStatus, connectionAttempt, true)}
          </p>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {connectionStatus === "disconnected" ? (
            <Button
              onClick={() => {
                setError(null);
                setRetryNonce((value) => value + 1);
              }}
              type="button"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <section
        className="rounded-lg bg-zinc-950 p-2 text-white shadow-inner sm:p-4"
        style={{ minHeight: 640 }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2 px-1 sm:px-0">
          <div>
            <h1 className="font-bold text-2xl">Live Poker</h1>
            <p className="text-emerald-100 text-sm">
              {state.phase} · Blinds {chip(state.smallBlind)} /{" "}
              {chip(state.bigBlind)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {state.isHost ? (
              <Button
                className={
                  state.gamePaused
                    ? "h-8 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                    : "h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                }
                disabled={!isConnected}
                onClick={() =>
                  send({
                    paused: !state.gamePaused,
                    type: "setTablePaused",
                  })
                }
                size="sm"
                type="button"
                variant={state.gamePaused ? "default" : "outline"}
              >
                {state.gamePaused ? (
                  <Play aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <Pause aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {tableControlLabel(state)}
              </Button>
            ) : null}
            {!state.isHost && state.gamePaused ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-400/15 px-3 font-semibold text-amber-200 text-xs ring-1 ring-amber-300/20">
                <Pause aria-hidden="true" className="h-3.5 w-3.5" />
                Paused by host
              </span>
            ) : null}
            <div
              aria-live="polite"
              className={`flex items-center gap-2 rounded-full px-3 py-1 font-medium text-xs ${
                isConnected
                  ? "bg-emerald-950 text-emerald-100"
                  : "bg-amber-950 text-amber-100"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {connectionLabel(connectionStatus, connectionAttempt)}
            </div>
          </div>
        </div>

        <div
          className="relative mx-auto mb-48 min-h-[36rem] max-w-7xl overflow-visible rounded-lg border border-white/10 bg-zinc-950 px-2 py-16 shadow-2xl sm:min-h-[41.25rem] sm:px-16 sm:py-24 md:mb-32 lg:px-24"
          style={tableStageStyle}
        >
          <div className="absolute inset-0" style={tableVignetteStyle} />
          <div
            className="relative h-[24rem] rounded-full border-8 border-zinc-800 bg-emerald-700 sm:h-[27.5rem]"
            style={tableFeltStyle}
          >
            <div
              className="absolute inset-4 rounded-full border border-emerald-200/20 bg-emerald-700"
              style={tableFeltSurfaceStyle}
            />
            <div className="absolute inset-10 rounded-full border border-emerald-100/20 border-dashed" />

            <div
              className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center"
              style={tableCenterStyle}
            >
              <WinnerAnnouncement state={state} />
              <NextHandIntermission serverNow={serverClockNow} state={state} />
              <CenterPot
                amount={state?.pot ?? 0}
                phase={state?.phase ?? "connecting"}
              />
              <div className="flex min-h-16 max-w-full flex-wrap items-center justify-center gap-1.5 rounded-md border border-white/5 bg-black/10 px-3 py-3 shadow-inner sm:gap-2 sm:px-5">
                {state?.communityCards.length ? (
                  state.communityCards
                    .slice(0, visibleCommunityCardCount(state, serverClockNow))
                    .map((card, cardIndex) => (
                      <PlayingCard
                        animationDelayMs={
                          state.communityCardRevealStartIndex !== null &&
                          cardIndex >= state.communityCardRevealStartIndex
                            ? 0
                            : undefined
                        }
                        card={card}
                        key={card}
                      />
                    ))
                ) : (
                  <span className="font-medium text-emerald-50/55 text-sm">
                    Community cards
                  </span>
                )}
              </div>
            </div>
          </div>

          {state.isHost && typedPendingBuyInRequests.length > 0 ? (
            <div className="absolute top-1/2 left-1/2 z-40 w-[min(22rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2">
              <PendingBuyInRequestsPanel
                approvingId={approvingRequestId}
                disabled={!isConnected}
                onApprove={approveBuyInRequest}
                onReject={rejectBuyInRequest}
                rejectingId={rejectingRequestId}
                requests={typedPendingBuyInRequests}
              />
            </div>
          ) : null}

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
                  dealElapsedMs={
                    state.transition === "deal" && state.transitionDeadlineAt
                      ? LIVE_POKER_INITIAL_DEAL_MS -
                        (state.transitionDeadlineAt - serverClockNow)
                      : undefined
                  }
                  dealOrder={dealSequence.orderBySeat.get(index)}
                  dealtSeatCount={dealSequence.count}
                  phase={state.phase}
                  position={position}
                  seat={seat}
                  settledAction={state.settledAction}
                />
                <button
                  className="absolute z-20 w-24 -translate-x-1/2 -translate-y-1/2 touch-manipulation text-left transition-transform focus:z-30 focus:outline-none focus:ring-2 focus:ring-emerald-200 enabled:hover:z-30 enabled:hover:scale-105 sm:w-36 min-[380px]:w-28"
                  disabled={Boolean(seat) || !canRequestInitialBuyIn}
                  onClick={() => requestInitialBuyIn(index)}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                  }}
                  type="button"
                >
                  <Seat
                    isActive={state.activeSeatIndex === index}
                    isTimeBank={state.timeBankActive}
                    seat={seat}
                    turnProgress={
                      state.activeSeatIndex === index &&
                      state.turnDeadlineAt &&
                      state.turnStartedAt
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              ((state.turnDeadlineAt - serverClockNow) /
                                (state.turnDeadlineAt - state.turnStartedAt)) *
                                100
                            )
                          )
                        : undefined
                    }
                    winAmount={winnerAmountsBySeat.get(index)}
                  />
                </button>
                {seat && state.isHost && !seat.isCurrentUser ? (
                  <button
                    aria-label={`Kick ${seat.name} from seat ${index + 1}`}
                    className="absolute z-30 flex h-7 w-7 -translate-x-1/2 translate-y-5 items-center justify-center rounded-md bg-red-600 text-white shadow-lg ring-1 ring-white/20 transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                    disabled={!isConnected || state.phase !== "waiting"}
                    onClick={() => setKickingSeatIndex(index)}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                    title="Kick seat"
                    type="button"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {state &&
          currentSeat &&
          state.phase !== "waiting" &&
          betTargetBounds ? (
            <BettingControlsOverlay
              amount={betTargetAmount || betTargetBounds.minTarget}
              callAmount={Math.max(0, callAmount)}
              currentSeat={currentSeat}
              disabled={!canAct}
              onAmountChange={setBetTargetAmount}
              onSend={send}
              state={state}
            />
          ) : null}
        </div>

        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setKickingSeatIndex(null);
            }
          }}
          open={kickingSeatIndex !== null}
        >
          <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove player from table?</AlertDialogTitle>
              <AlertDialogDescription>
                {kickCandidate
                  ? `${kickCandidate.name} will be removed from seat ${kickCandidate.seatIndex + 1}. This cannot be undone.`
                  : "This seat is no longer occupied."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={
                  !isConnected || state.phase !== "waiting" || !kickCandidate
                }
                onClick={() => {
                  if (kickingSeatIndex !== null) {
                    kickSeat(kickingSeatIndex);
                  }
                }}
              >
                Remove player
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="space-y-3 rounded-lg bg-background p-3 text-foreground">
          {currentSeat ? (
            <div className="flex flex-wrap gap-2">
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
                    disabled={!canRequestAddOn}
                    onClick={requestAddOn}
                    variant="outline"
                  >
                    Request Chips
                  </Button>
                </>
              ) : null}
              <Button
                disabled={!isConnected}
                onClick={() =>
                  send({ sitOut: !currentSeat.sitOut, type: "sitOut" })
                }
                variant="ghost"
              >
                <Power className="h-4 w-4" />
                {currentSeat.sitOut ? "Return" : "Sit out"}
              </Button>
              <Button
                disabled={!isConnected || state.phase !== "waiting"}
                onClick={() => send({ type: "leaveSeat" })}
                variant="outline"
              >
                <LogOut className="h-4 w-4" />
                Leave Table
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
              <Button
                disabled={!canRequestInitialBuyIn}
                onClick={() => requestInitialBuyIn(-1)}
              >
                Request first open seat
              </Button>
            </div>
          )}
          <UserBuyInRequestStatus requests={typedUserBuyInRequests} />
          {state.isHost && disconnectedEligiblePlayerCount > 0 ? (
            <p className="text-amber-700 text-sm">
              {disconnectedEligiblePlayerCount} disconnected seated player
              {disconnectedEligiblePlayerCount === 1 ? " is" : "s are"} still
              eligible to be dealt in, matching table rules.
            </p>
          ) : null}
          {error ? (
            <div className="flex flex-wrap items-center gap-2">
              <p
                aria-live="assertive"
                className="text-destructive text-sm"
                role="alert"
              >
                {error}
              </p>
              {connectionStatus === "disconnected" ? (
                <Button
                  onClick={() => {
                    setError(null);
                    setRetryNonce((value) => value + 1);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
