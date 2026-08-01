import { canStartHand, startHand } from "./engine";
import {
  clearLivePokerTiming,
  DEFAULT_LIVE_POKER_TIMING,
  type LivePokerTimingConfig,
  startLivePokerTransition,
} from "./timing";
import type { LivePokerState } from "./types";

export function startAutomaticHand(
  state: LivePokerState,
  startedAt: number,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  if (!canStartHand(state)) {
    return false;
  }

  startHand(state);
  startLivePokerTransition(state, "deal", startedAt + timing.initialDealMs);
  return true;
}

export function reconcileNextHandTransition(
  state: LivePokerState,
  now: number,
  timing: LivePokerTimingConfig = DEFAULT_LIVE_POKER_TIMING
) {
  if (state.phase !== "waiting") {
    return false;
  }

  if (!canStartHand(state)) {
    if (state.transition !== "nextHand") {
      return false;
    }
    clearLivePokerTiming(state);
    return true;
  }

  if (
    state.transition === "nextHand" &&
    Number.isFinite(state.transitionDeadlineAt)
  ) {
    return false;
  }

  startLivePokerTransition(state, "nextHand", now + timing.nextHandMs);
  return true;
}
