import type { LivePokerState, LivePokerTransition } from "./types";

export const LIVE_POKER_ACTION_TIME_MS = 20_000;
export const LIVE_POKER_TIME_BANK_MS = 10_000;
export const LIVE_POKER_ACTION_SETTLE_MS = 800;
export const LIVE_POKER_INITIAL_DEAL_MS = 2300;
export const LIVE_POKER_NEXT_HAND_MS = 3000;
export const LIVE_POKER_SHOWDOWN_MS = 6000;
export const LIVE_POKER_RUNOUT_STAGE_MS = 1000;

export interface LivePokerTimingConfig {
  actionTimeMs: number;
  actionSettleMs: number;
  initialDealMs: number;
  nextHandMs: number;
  runoutStageMs: number;
  showdownMs: number;
  timeBankMs: number;
}

export const DEFAULT_LIVE_POKER_TIMING = {
  actionTimeMs: LIVE_POKER_ACTION_TIME_MS,
  actionSettleMs: LIVE_POKER_ACTION_SETTLE_MS,
  initialDealMs: LIVE_POKER_INITIAL_DEAL_MS,
  nextHandMs: LIVE_POKER_NEXT_HAND_MS,
  runoutStageMs: LIVE_POKER_RUNOUT_STAGE_MS,
  showdownMs: LIVE_POKER_SHOWDOWN_MS,
  timeBankMs: LIVE_POKER_TIME_BANK_MS,
} satisfies LivePokerTimingConfig;

export interface LivePokerTimeoutAction {
  type: "check" | "fold";
}

function normalizeTimeBankRemainingMs(
  value: number,
  initialTimeBankMs: number
) {
  if (!Number.isFinite(value)) {
    return initialTimeBankMs;
  }
  return Math.min(initialTimeBankMs, Math.max(0, Math.round(value)));
}

export function getLivePokerSeatTimeBankRemainingMs(
  state: LivePokerState,
  seatIndex: number,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  const seat = state.seats[seatIndex];
  if (!seat) {
    return 0;
  }
  return normalizeTimeBankRemainingMs(
    seat.timeBankRemainingMs,
    timing.timeBankMs
  );
}

export function repairLivePokerTimeBanks(
  state: LivePokerState,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  let changed = false;
  for (const seat of state.seats) {
    if (!seat) {
      continue;
    }
    const remaining = normalizeTimeBankRemainingMs(
      seat.timeBankRemainingMs,
      timing.timeBankMs
    );
    if (seat.timeBankRemainingMs !== remaining) {
      seat.timeBankRemainingMs = remaining;
      changed = true;
    }
  }
  return changed;
}

export type LivePokerTimingEvent =
  | { at: number; type: "startTimeBank" }
  | { at: number; type: "turnExpired" }
  | { at: number; transition: LivePokerTransition; type: "transition" };

export function assertLivePokerActionAvailable(state: LivePokerState) {
  if (state.transition) {
    throw new Error("Actions are paused while the table settles");
  }
  if (!state.turnDeadlineAt) {
    throw new Error("No action is currently available");
  }
}

export function getLivePokerTimeoutAction(
  state: LivePokerState
): LivePokerTimeoutAction | null {
  if (state.activeSeatIndex === null) {
    return null;
  }
  const seat = state.seats[state.activeSeatIndex];
  if (!seat) {
    return null;
  }
  return { type: state.currentBet <= seat.bet ? "check" : "fold" };
}

export function clearLivePokerTiming(state: LivePokerState) {
  state.timeBankActive = false;
  state.transition = null;
  state.transitionDeadlineAt = null;
  state.turnDeadlineAt = null;
  state.turnStartedAt = null;
}

export function startLivePokerTurn(
  state: LivePokerState,
  startedAt: number,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  state.timeBankActive = false;
  state.transition = null;
  state.transitionDeadlineAt = null;
  state.turnStartedAt = startedAt;
  state.turnDeadlineAt = startedAt + timing.actionTimeMs;
}

export function startLivePokerTimeBank(
  state: LivePokerState,
  startedAt: number,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  const remaining =
    state.activeSeatIndex === null
      ? 0
      : getLivePokerSeatTimeBankRemainingMs(
          state,
          state.activeSeatIndex,
          timing
        );
  state.timeBankActive = remaining > 0;
  state.turnStartedAt = startedAt;
  state.turnDeadlineAt = startedAt + remaining;
}

export function consumeLivePokerTimeBank(
  state: LivePokerState,
  seatIndex: number,
  actedAt: number,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  if (
    !state.timeBankActive ||
    state.turnDeadlineAt === null ||
    state.turnDeadlineAt === undefined
  ) {
    return 0;
  }

  const seat = state.seats[seatIndex];
  if (!seat) {
    return 0;
  }
  const previousRemaining = getLivePokerSeatTimeBankRemainingMs(
    state,
    seatIndex,
    timing
  );
  const remainingAtAction = Math.min(
    previousRemaining,
    Math.max(0, Math.round(state.turnDeadlineAt - actedAt))
  );
  seat.timeBankRemainingMs = remainingAtAction;
  return previousRemaining - remainingAtAction;
}

export function startLivePokerTransition(
  state: LivePokerState,
  transition: LivePokerTransition,
  deadlineAt: number
) {
  state.timeBankActive = false;
  state.transition = transition;
  state.transitionDeadlineAt = deadlineAt;
  state.turnDeadlineAt = null;
  state.turnStartedAt = null;
}

export function getDueLivePokerTimingEvent(
  state: LivePokerState,
  now: number
): LivePokerTimingEvent | null {
  if (
    state.transition &&
    state.transitionDeadlineAt !== null &&
    state.transitionDeadlineAt !== undefined &&
    state.transitionDeadlineAt <= now
  ) {
    return {
      at: state.transitionDeadlineAt,
      transition: state.transition,
      type: "transition",
    };
  }

  if (
    state.turnDeadlineAt !== null &&
    state.turnDeadlineAt !== undefined &&
    state.turnDeadlineAt <= now
  ) {
    const hasTimeBank =
      state.activeSeatIndex !== null &&
      getLivePokerSeatTimeBankRemainingMs(state, state.activeSeatIndex) > 0;
    return {
      at: state.turnDeadlineAt,
      type:
        state.timeBankActive || !hasTimeBank ? "turnExpired" : "startTimeBank",
    };
  }

  return null;
}

export function getNextLivePokerDeadline(state: LivePokerState) {
  return Math.min(
    state.transitionDeadlineAt ?? Number.POSITIVE_INFINITY,
    state.turnDeadlineAt ?? Number.POSITIVE_INFINITY
  );
}
