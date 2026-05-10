"use client";

import {
  Check,
  CircleDollarSign,
  Loader2,
  LogOut,
  Minus,
  Play,
  Plus,
  Power,
  UserX,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConvexUser } from "@/lib/convex-hooks";
import type {
  LivePokerClientMessage,
  LivePokerServerMessage,
  PublicLivePokerSeat,
  PublicLivePokerState,
} from "@/lib/live-poker/types";
import {
  useCreateLivePokerBuyInRequest,
  usePendingLivePokerBuyInRequests,
  useRespondToLivePokerBuyInRequest,
  useUserLivePokerBuyInRequests,
} from "@/lib/live-poker-hooks";
import type { Id } from "../../../convex/_generated/dataModel";

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
  minHeight: 660,
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

function getPresetBetTarget(
  multiplier: number,
  state: PublicLivePokerState,
  seat: PublicLivePokerSeat
) {
  const baseline = state.currentBet > 0 ? state.currentBet : state.bigBlind;
  const { maxTarget, minTarget } = getBetTargetBounds(state, seat);
  return clamp(baseline * multiplier, minTarget, maxTarget);
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

function BettingControlsOverlay({
  amount,
  callAmount,
  currentSeat,
  onAmountChange,
  onSend,
  state,
}: {
  amount: number;
  callAmount: number;
  currentSeat: PublicLivePokerSeat;
  onAmountChange: (amount: number) => void;
  onSend: (message: LivePokerClientMessage) => void;
  state: PublicLivePokerState;
}) {
  const { maxTarget, minTarget } = getBetTargetBounds(state, currentSeat);
  const step = Math.max(1, state.bigBlind || 1);
  const hasCallAmount = callAmount > 0;
  const clampedAmount = clamp(amount, minTarget, maxTarget);
  const actionLabel = state.currentBet > 0 ? "Raise" : "Bet";

  function setTarget(nextAmount: number) {
    onAmountChange(clamp(nextAmount, minTarget, maxTarget));
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

  return (
    <div className="absolute right-3 bottom-[-6.25rem] left-3 z-40 flex justify-center sm:right-6 sm:left-6">
      <div className="flex w-full max-w-3xl flex-col gap-1.5 rounded-lg border border-white/10 bg-zinc-950/90 p-2 text-white shadow-2xl backdrop-blur-md md:flex-row md:items-stretch">
        <div className="grid grid-cols-3 gap-1 md:w-64">
          <Button
            className="h-9 border-white/10 bg-zinc-900/90 text-white hover:bg-zinc-800"
            onClick={() => onSend({ type: "fold" })}
            size="sm"
            type="button"
            variant="outline"
          >
            Fold
          </Button>
          <Button
            className="h-9 border-white/10 bg-zinc-900/90 text-white hover:bg-zinc-800"
            disabled={hasCallAmount}
            onClick={() => onSend({ type: "check" })}
            size="sm"
            type="button"
            variant="outline"
          >
            Check
          </Button>
          <Button
            className="h-9 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            disabled={!hasCallAmount}
            onClick={() => onSend({ type: "call" })}
            size="sm"
            type="button"
          >
            Call {chip(Math.max(0, callAmount))}
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-4 overflow-hidden rounded-md border border-white/10 bg-zinc-900/80">
            {[2, 3, 4].map((multiplier) => (
              <button
                className="h-8 border-white/10 border-r font-semibold text-sm text-zinc-200 transition-colors hover:bg-white/10"
                key={multiplier}
                onClick={() =>
                  setTarget(getPresetBetTarget(multiplier, state, currentSeat))
                }
                type="button"
              >
                {multiplier}x
              </button>
            ))}
            <button
              className="h-8 font-semibold text-sm text-zinc-200 transition-colors hover:bg-white/10"
              onClick={() => setTarget(maxTarget)}
              type="button"
            >
              All-In
            </button>
          </div>

          <div className="mt-1.5 grid grid-cols-[auto_minmax(7rem,1fr)_auto_auto_auto] items-center gap-2">
            <button
              aria-label="Decrease bet"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900/90 text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-zinc-800"
              onClick={() => setTarget(clampedAmount - step)}
              type="button"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              className="h-2 min-w-0 accent-emerald-400"
              max={maxTarget}
              min={minTarget}
              onChange={(event) => setTarget(Number(event.target.value))}
              step={step}
              type="range"
              value={clampedAmount}
            />
            <button
              aria-label="Increase bet"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900/90 text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-zinc-800"
              onClick={() => setTarget(clampedAmount + step)}
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex h-8 min-w-24 items-center justify-center rounded-md bg-black px-3 font-bold text-white shadow-inner ring-1 ring-white/10">
              {chip(clampedAmount)}
            </div>
            <Button
              className="h-8 bg-emerald-500 px-5 text-zinc-950 hover:bg-emerald-400"
              disabled={maxTarget <= 0}
              onClick={submitBetOrRaise}
              type="button"
            >
              {clampedAmount >= maxTarget ? "All In" : actionLabel}
            </Button>
          </div>
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
  onApprove,
  onReject,
  rejectingId,
  requests,
}: {
  approvingId: string | null;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  rejectingId: string | null;
  requests: LivePokerBuyInRequestRow[];
}) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-amber-950">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-sm">Pending buy-ins</h2>
          <p className="text-amber-800 text-xs">
            Approving seats the player or adds chips immediately.
          </p>
        </div>
        <span className="rounded-md bg-amber-200 px-2 py-1 font-semibold text-xs">
          {requests.length}
        </span>
      </div>
      <div className="space-y-2">
        {requests.map((request) => (
          <div
            className="flex flex-col gap-2 rounded-md border border-amber-200 bg-white p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            key={request._id}
          >
            <div>
              <p className="font-medium">
                {request.player?.name ?? "Player"} requested{" "}
                {chip(request.amount)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={
                  approvingId === request._id || rejectingId === request._id
                }
                onClick={() => onReject(request._id)}
                size="sm"
                variant="outline"
              >
                {rejectingId === request._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Reject
                  </>
                )}
              </Button>
              <Button
                disabled={
                  approvingId === request._id || rejectingId === request._id
                }
                onClick={() => onApprove(request._id)}
                size="sm"
              >
                {approvingId === request._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Approve
                  </>
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
  const { userId } = useConvexUser();
  const tableConvexId = tableId as Id<"livePokerTables">;
  const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
  const [buyIn, setBuyIn] = useState("100");
  const [betTargetAmount, setBetTargetAmount] = useState(0);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isRequestingBuyIn, setIsRequestingBuyIn] = useState(false);
  const [kickingSeatIndex, setKickingSeatIndex] = useState<number | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [state, setState] = useState<PublicLivePokerState | null>(null);
  const createBuyInRequest = useCreateLivePokerBuyInRequest();
  const respondToBuyInRequest = useRespondToLivePokerBuyInRequest();
  const { requests: pendingBuyInRequests } = usePendingLivePokerBuyInRequests(
    tableConvexId,
    userId
  );
  const { requests: userBuyInRequests } = useUserLivePokerBuyInRequests(
    tableConvexId,
    userId
  );

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
        player: {
          id: Id<"players">;
          name: string;
        };
        token: string;
      };

      setPlayerId(body.player.id);

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
    Boolean(currentSeat && state?.phase === "waiting") &&
    Number(buyIn) > 0 &&
    Number(buyIn) <= (state?.maxBuyIn ?? Number.POSITIVE_INFINITY) &&
    !isRequestingBuyIn;
  const canRequestInitialBuyIn =
    Boolean(!currentSeat && state?.phase === "waiting") &&
    Number(buyIn) >= (state?.minBuyIn ?? 0) &&
    Number(buyIn) <= (state?.maxBuyIn ?? 0) &&
    !isRequestingBuyIn;
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
  const typedPendingBuyInRequests =
    pendingBuyInRequests as LivePokerBuyInRequestRow[];
  const typedUserBuyInRequests =
    userBuyInRequests as LivePokerBuyInRequestRow[];

  useEffect(() => {
    if (!(canAct && betTargetResetKey)) {
      return;
    }

    setBetTargetAmount(betTargetMin);
  }, [betTargetMin, betTargetResetKey, canAct]);

  async function requestInitialBuyIn(seatIndex: number) {
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
        amount: Number(buyIn),
        playerId,
        seatIndex: firstOpenSeat,
        tableId: tableConvexId,
        type: "INITIAL",
        userId,
      });
      if (state.isHost) {
        await approveBuyInRequest(String(requestId));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to request buy-in"
      );
    } finally {
      setIsRequestingBuyIn(false);
    }
  }

  async function requestAddOn() {
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
        amount: Number(buyIn),
        playerId,
        tableId: tableConvexId,
        type: "ADD_ON",
        userId,
      });
      if (state?.isHost) {
        await approveBuyInRequest(String(requestId));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to request chips"
      );
    } finally {
      setIsRequestingBuyIn(false);
    }
  }

  async function approveBuyInRequest(requestId: string) {
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
      send({ type: "requestSync" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to approve buy-in request"
      );
    } finally {
      setApprovingRequestId(null);
    }
  }

  async function rejectBuyInRequest(requestId: string) {
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
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reject buy-in request"
      );
    } finally {
      setRejectingRequestId(null);
    }
  }

  function kickSeat(seatIndex: number) {
    setKickingSeatIndex(null);
    send({ seatIndex, type: "kickSeat" });
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
          className="relative mx-auto mb-32 max-w-7xl overflow-visible rounded-lg border border-white/10 bg-zinc-950 px-8 py-20 shadow-2xl sm:px-16 sm:py-24 lg:px-24"
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
                  onClick={() =>
                    seat ? undefined : requestInitialBuyIn(index)
                  }
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
                {seat && state.isHost && !seat.isCurrentUser ? (
                  <button
                    aria-label={`Kick ${seat.name} from seat ${index + 1}`}
                    className="absolute z-30 flex h-7 w-7 -translate-x-1/2 translate-y-5 items-center justify-center rounded-md bg-red-600 text-white shadow-lg ring-1 ring-white/20 transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                    disabled={state.phase !== "waiting"}
                    onClick={() =>
                      kickingSeatIndex === index
                        ? kickSeat(index)
                        : setKickingSeatIndex(index)
                    }
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                    title={
                      kickingSeatIndex === index
                        ? "Click again to confirm"
                        : "Kick seat"
                    }
                    type="button"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {state && currentSeat && canAct && betTargetBounds ? (
            <BettingControlsOverlay
              amount={betTargetAmount || betTargetBounds.minTarget}
              callAmount={Math.max(0, callAmount)}
              currentSeat={currentSeat}
              onAmountChange={setBetTargetAmount}
              onSend={send}
              state={state}
            />
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg bg-background p-3 text-foreground">
          {state?.isHost ? (
            <PendingBuyInRequestsPanel
              approvingId={approvingRequestId}
              onApprove={approveBuyInRequest}
              onReject={rejectBuyInRequest}
              rejectingId={rejectingRequestId}
              requests={typedPendingBuyInRequests}
            />
          ) : null}
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
                    disabled={!canRequestAddOn}
                    onClick={requestAddOn}
                    variant="outline"
                  >
                    Request Chips
                  </Button>
                </>
              ) : null}
              <Button
                onClick={() =>
                  send({ sitOut: !currentSeat.sitOut, type: "sitOut" })
                }
                variant="ghost"
              >
                <Power className="h-4 w-4" />
                {currentSeat.sitOut ? "Return" : "Sit out"}
              </Button>
              <Button
                disabled={state?.phase !== "waiting"}
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
          {error ? (
            <p className="mt-2 text-destructive text-sm">{error}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
