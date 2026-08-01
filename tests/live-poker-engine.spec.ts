import { expect, test } from "@playwright/test";
import {
  applyAction,
  cleanupShowdown,
  createInitialState,
  revealNextRunoutStage,
  seatPlayer,
  settleShowdown,
  startHand,
} from "../src/lib/live-poker/engine";
import {
  assertLivePokerActionAvailable,
  consumeLivePokerTimeBank,
  DEFAULT_LIVE_POKER_TIMING,
  getDueLivePokerTimingEvent,
  getLivePokerTimeoutAction,
  getNextLivePokerDeadline,
  LIVE_POKER_ACTION_SETTLE_MS,
  LIVE_POKER_ACTION_TIME_MS,
  LIVE_POKER_INITIAL_DEAL_MS,
  LIVE_POKER_RUNOUT_STAGE_MS,
  LIVE_POKER_SHOWDOWN_MS,
  LIVE_POKER_TIME_BANK_MS,
  startLivePokerTimeBank,
  startLivePokerTransition,
  startLivePokerTurn,
} from "../src/lib/live-poker/timing";
import {
  type LivePokerSeat,
  type LivePokerState,
  toPublicState,
} from "../src/lib/live-poker/types";

function makeState(overrides: Partial<LivePokerState> = {}) {
  return {
    ...createInitialState({
      bigBlind: 10,
      hostUserId: "host",
      maxBuyIn: 500,
      minBuyIn: 0.01,
      seatCount: 6,
      smallBlind: 5,
    }),
    ...overrides,
  };
}

function addSeat(
  state: LivePokerState,
  seatIndex: number,
  buyIn: number,
  ready = false
) {
  seatPlayer(state, seatIndex, {
    buyIn,
    name: `Player ${seatIndex}`,
    playerId: `player-${seatIndex}`,
    userId: `user-${seatIndex}`,
  });
  const seat = state.seats[seatIndex] as LivePokerSeat;
  seat.ready = ready;
  return seat;
}

function prepareSeat(
  state: LivePokerState,
  seatIndex: number,
  values: Partial<LivePokerSeat>
) {
  const seat = addSeat(state, seatIndex, values.buyIn ?? 200);
  Object.assign(seat, {
    cards: [`${seatIndex + 2}C`, `${seatIndex + 2}D`],
    ...values,
  });
  return seat;
}

function totalChips(state: LivePokerState) {
  return state.seats.reduce(
    (total, seat) => total + (seat ? seat.stack + seat.committed : 0),
    0
  );
}

test.describe("live poker betting correctness", () => {
  test("rejects a raise target above the player's stack without mutation", () => {
    const state = makeState({
      activeSeatIndex: 0,
      currentBet: 20,
      minRaise: 10,
      phase: "flop",
    });
    prepareSeat(state, 0, {
      bet: 20,
      committed: 20,
      stack: 30,
    });
    prepareSeat(state, 1, {
      bet: 20,
      committed: 20,
      stack: 180,
    });
    const before = structuredClone(state);

    expect(() =>
      applyAction(state, "user-0", { amount: 60, type: "raise" })
    ).toThrow("Bet target exceeds available stack");
    expect(state).toEqual(before);
  });

  test("keeps the nominal big-blind bring-in when the big blind is short", () => {
    const state = makeState({ seatCount: 2, seats: [null, null] });
    const smallBlind = addSeat(state, 0, 100, true);
    const bigBlind = addSeat(state, 1, 7, true);

    startHand(state);

    expect(state.bigBlindSeatIndex).toBe(1);
    expect(bigBlind.bet).toBe(7);
    expect(bigBlind.isAllIn).toBe(true);
    expect(state.currentBet).toBe(10);
    expect(state.activeSeatIndex).toBe(0);

    applyAction(state, smallBlind.userId, { type: "call" });

    expect(smallBlind.bet).toBe(10);
    expect(smallBlind.committed).toBe(10);
    expect(state.phase).toBe("preflop");
    expect(state.runoutPending).toBe(true);
    expect(state.communityCards).toHaveLength(0);
  });

  test("stages an all-in board runout one street at a time", () => {
    const state = makeState({ seatCount: 2, seats: [null, null] });
    addSeat(state, 0, 3, true);
    addSeat(state, 1, 7, true);

    startHand(state);

    expect(state.currentBet).toBe(10);
    expect(state.seats[0]?.isAllIn).toBe(true);
    expect(state.seats[1]?.isAllIn).toBe(true);
    expect(state.activeSeatIndex).toBeNull();
    expect(state.phase).toBe("preflop");
    expect(state.runoutPending).toBe(true);
    expect(state.communityCards).toHaveLength(0);

    revealNextRunoutStage(state);
    expect(state.phase).toBe("flop");
    expect(state.communityCards).toHaveLength(3);
    expect(state.runoutPending).toBe(true);

    revealNextRunoutStage(state);
    expect(state.phase).toBe("turn");
    expect(state.communityCards).toHaveLength(4);

    revealNextRunoutStage(state);
    expect(state.phase).toBe("showdown");
    expect(state.communityCards).toHaveLength(5);
    expect(state.runoutPending).toBe(false);
  });

  test("queues a runout when only a matched big blind still has chips", () => {
    const state = makeState({ seatCount: 2, seats: [null, null] });
    addSeat(state, 0, 3, true);
    addSeat(state, 1, 100, true);

    startHand(state);

    expect(state.seats[0]?.isAllIn).toBe(true);
    expect(state.seats[1]?.isAllIn).toBe(false);
    expect(state.seats[1]?.bet).toBe(10);
    expect(state.activeSeatIndex).toBeNull();
    expect(state.phase).toBe("preflop");
    expect(state.runoutPending).toBe(true);
    expect(state.communityCards).toHaveLength(0);
  });

  test("does not reduce the last full raise or reopen action after a short all-in", () => {
    const state = makeState({
      activeSeatIndex: 1,
      currentBet: 100,
      dealerSeatIndex: 2,
      minRaise: 40,
      phase: "turn",
    });
    const alreadyActed = prepareSeat(state, 0, {
      bet: 100,
      committed: 100,
      hasActedThisStreet: true,
      stack: 100,
    });
    const shortStack = prepareSeat(state, 1, {
      bet: 100,
      committed: 100,
      stack: 15,
    });
    const notYetActed = prepareSeat(state, 2, {
      bet: 100,
      committed: 100,
      stack: 100,
    });

    applyAction(state, shortStack.userId, { type: "allIn" });

    expect(state.currentBet).toBe(115);
    expect(state.minRaise).toBe(40);
    expect(alreadyActed.hasActedThisStreet).toBe(true);
    expect(notYetActed.hasActedThisStreet).toBe(false);
    expect(state.activeSeatIndex).toBe(2);

    applyAction(state, notYetActed.userId, { type: "call" });
    expect(state.activeSeatIndex).toBe(0);

    const beforeRejectedRaise = structuredClone(state);
    expect(() =>
      applyAction(state, alreadyActed.userId, {
        amount: 155,
        type: "raise",
      })
    ).toThrow("Betting has not been reopened");
    expect(state).toEqual(beforeRejectedRaise);
    expect(() =>
      applyAction(state, alreadyActed.userId, { type: "allIn" })
    ).toThrow("Betting has not been reopened");
    expect(state).toEqual(beforeRejectedRaise);

    applyAction(state, alreadyActed.userId, { type: "call" });
    expect(alreadyActed.committed).toBe(115);
    expect(state.phase).toBe("river");
  });

  test("a full all-in raise does reopen action and sets the new full raise size", () => {
    const state = makeState({
      activeSeatIndex: 1,
      currentBet: 100,
      minRaise: 40,
      phase: "flop",
    });
    const alreadyActed = prepareSeat(state, 0, {
      bet: 100,
      committed: 100,
      hasActedThisStreet: true,
      stack: 100,
    });
    const fullRaiser = prepareSeat(state, 1, {
      bet: 100,
      committed: 100,
      stack: 50,
    });
    prepareSeat(state, 2, {
      bet: 100,
      committed: 100,
      hasActedThisStreet: true,
      stack: 100,
    });

    applyAction(state, fullRaiser.userId, { type: "allIn" });

    expect(state.currentBet).toBe(150);
    expect(state.minRaise).toBe(50);
    expect(alreadyActed.hasActedThisStreet).toBe(false);
  });

  test("enforces the existing one-cent chip denomination at engine boundaries", () => {
    expect(() =>
      createInitialState({
        bigBlind: 0.02,
        hostUserId: "host",
        maxBuyIn: 10,
        minBuyIn: 0.01,
        seatCount: 2,
        smallBlind: 0.005,
      })
    ).toThrow("Small blind must use increments of 0.01");

    const state = makeState({
      activeSeatIndex: 0,
      currentBet: 10,
      phase: "flop",
    });
    prepareSeat(state, 0, { bet: 10, committed: 10, stack: 100 });
    prepareSeat(state, 1, { bet: 10, committed: 10, stack: 100 });
    const before = structuredClone(state);

    expect(() =>
      applyAction(state, "user-0", { amount: 20.001, type: "raise" })
    ).toThrow("Bet target must use increments of 0.01");
    expect(state).toEqual(before);
  });
});

test.describe("live poker server timing", () => {
  test("uses named PokerNow-equivalent pacing defaults", () => {
    expect(DEFAULT_LIVE_POKER_TIMING).toEqual({
      actionSettleMs: LIVE_POKER_ACTION_SETTLE_MS,
      actionTimeMs: LIVE_POKER_ACTION_TIME_MS,
      initialDealMs: LIVE_POKER_INITIAL_DEAL_MS,
      runoutStageMs: LIVE_POKER_RUNOUT_STAGE_MS,
      showdownMs: LIVE_POKER_SHOWDOWN_MS,
      timeBankMs: LIVE_POKER_TIME_BANK_MS,
    });
    expect(DEFAULT_LIVE_POKER_TIMING).toEqual({
      actionSettleMs: 800,
      actionTimeMs: 20_000,
      initialDealMs: 2300,
      runoutStageMs: 1000,
      showdownMs: 6000,
      timeBankMs: 10_000,
    });
  });

  test("moves deterministically from the action clock into the visible time bank", () => {
    const state = makeState({ activeSeatIndex: 0, phase: "preflop" });
    addSeat(state, 0, 100);

    startLivePokerTurn(state, 1000);
    expect(state.turnStartedAt).toBe(1000);
    expect(state.turnDeadlineAt).toBe(21_000);
    expect(state.timeBankActive).toBe(false);
    expect(getDueLivePokerTimingEvent(state, 20_999)).toBeNull();
    expect(getDueLivePokerTimingEvent(state, 21_000)).toEqual({
      at: 21_000,
      type: "startTimeBank",
    });

    startLivePokerTimeBank(state, 21_000);
    expect(state.timeBankActive).toBe(true);
    expect(state.turnStartedAt).toBe(21_000);
    expect(state.turnDeadlineAt).toBe(31_000);
    expect(getDueLivePokerTimingEvent(state, 31_000)).toEqual({
      at: 31_000,
      type: "turnExpired",
    });
  });

  test("persists partial time-bank consumption from authoritative deadlines", () => {
    const state = makeState({ activeSeatIndex: 0, phase: "preflop" });
    const seat = addSeat(state, 0, 100);
    const otherSeat = addSeat(state, 1, 100);

    startLivePokerTurn(state, 1000);
    startLivePokerTimeBank(state, 21_000);

    expect(consumeLivePokerTimeBank(state, 0, 24_500)).toBe(3500);
    expect(seat.timeBankRemainingMs).toBe(6500);
    expect(otherSeat.timeBankRemainingMs).toBe(10_000);

    startLivePokerTurn(state, 30_000);
    expect(getDueLivePokerTimingEvent(state, 50_000)).toEqual({
      at: 50_000,
      type: "startTimeBank",
    });
    startLivePokerTimeBank(state, 50_000);
    expect(state.turnDeadlineAt).toBe(56_500);
    expect(toPublicState(state, seat.userId, 52_000).seats[0]).toMatchObject({
      timeBankRemainingMs: 4500,
    });
  });

  test("exhausts a time bank and gives later turns no hidden extension", () => {
    const state = makeState({ activeSeatIndex: 0, phase: "preflop" });
    const seat = addSeat(state, 0, 100);

    startLivePokerTurn(state, 1000);
    startLivePokerTimeBank(state, 21_000);
    expect(consumeLivePokerTimeBank(state, 0, 31_000)).toBe(10_000);
    expect(seat.timeBankRemainingMs).toBe(0);

    startLivePokerTurn(state, 40_000);
    expect(state.turnDeadlineAt).toBe(60_000);
    expect(getDueLivePokerTimingEvent(state, 60_000)).toEqual({
      at: 60_000,
      type: "turnExpired",
    });
  });

  test("does not regrant a consumed time bank when a later hand starts", () => {
    const state = makeState({ seatCount: 2, seats: [null, null] });
    const seat = addSeat(state, 0, 100, true);
    addSeat(state, 1, 100, true);
    expect(seat.timeBankRemainingMs).toBe(10_000);
    seat.timeBankRemainingMs = 3200;

    startHand(state);

    expect(seat.timeBankRemainingMs).toBe(3200);
  });

  test("chooses check or fold deterministically at final expiry", () => {
    const state = makeState({
      activeSeatIndex: 0,
      currentBet: 20,
      phase: "preflop",
    });
    const seat = addSeat(state, 0, 100);
    seat.bet = 10;

    expect(getLivePokerTimeoutAction(state)).toEqual({ type: "fold" });
    seat.bet = 20;
    expect(getLivePokerTimeoutAction(state)).toEqual({ type: "check" });
    state.activeSeatIndex = null;
    expect(getLivePokerTimeoutAction(state)).toBeNull();
  });

  test("rejects actions throughout persisted deal and settle windows", () => {
    const state = makeState({ activeSeatIndex: 0, phase: "preflop" });

    startLivePokerTransition(state, "deal", 3300);
    expect(() => assertLivePokerActionAvailable(state)).toThrow(
      "Actions are paused while the table settles"
    );

    startLivePokerTransition(state, "actionSettle", 4100);
    expect(() => assertLivePokerActionAvailable(state)).toThrow(
      "Actions are paused while the table settles"
    );

    startLivePokerTurn(state, 4100);
    expect(() => assertLivePokerActionAvailable(state)).not.toThrow();
  });

  test("persists transition kinds and exact alarm deadlines", () => {
    const state = makeState({ activeSeatIndex: 0, phase: "preflop" });

    startLivePokerTransition(state, "deal", 3300);
    expect(getNextLivePokerDeadline(state)).toBe(3300);
    expect(getDueLivePokerTimingEvent(state, 3299)).toBeNull();
    expect(getDueLivePokerTimingEvent(state, 3300)).toEqual({
      at: 3300,
      transition: "deal",
      type: "transition",
    });
    expect(state.turnDeadlineAt).toBeNull();
    expect(state.transition).toBe("deal");
  });
});

test.describe("live poker payout correctness", () => {
  test("conserves a tied pot and awards its odd cent clockwise from the dealer", () => {
    const state = makeState({
      communityCards: ["AS", "KS", "QS", "JS", "TS"],
      dealerSeatIndex: 0,
      deck: [],
      phase: "showdown",
    });
    const dealer = prepareSeat(state, 0, {
      cards: ["2C", "3D"],
      committed: 0.05,
      stack: 1,
    });
    prepareSeat(state, 1, {
      cards: ["4C", "5D"],
      committed: 0.05,
      folded: true,
      stack: 1,
    });
    const leftOfDealer = prepareSeat(state, 2, {
      cards: ["6C", "7D"],
      committed: 0.05,
      stack: 1,
    });
    const before = totalChips(state);

    const winners = settleShowdown(state);

    expect(winners).toEqual([
      expect.objectContaining({ amount: 0.08, seatIndex: 2 }),
      expect.objectContaining({ amount: 0.07, seatIndex: 0 }),
    ]);
    expect(leftOfDealer.stack).toBe(1.08);
    expect(dealer.stack).toBe(1.07);
    expect(totalChips(state)).toBe(before);
    expect(winners.reduce((sum, winner) => sum + winner.amount, 0)).toBeCloseTo(
      0.15
    );
  });

  test("keeps showdown results visible until explicit cleanup", () => {
    const state = makeState({
      communityCards: ["AS", "KS", "QS", "JS", "TS"],
      dealerSeatIndex: 0,
      deck: [],
      phase: "showdown",
    });
    const winner = prepareSeat(state, 0, {
      cards: ["2C", "3D"],
      committed: 20,
      stack: 80,
    });
    prepareSeat(state, 1, {
      cards: ["4C", "5D"],
      committed: 20,
      folded: true,
      stack: 80,
    });

    const winners = settleShowdown(state);
    const paidStack = winner.stack;

    expect(state.phase).toBe("showdown");
    expect(state.showdownSettled).toBe(true);
    expect(state.showdownPot).toBe(40);
    expect(state.communityCards).toHaveLength(5);
    expect(state.lastWinners).toEqual(winners);
    expect(state.seats[0]?.cards).toHaveLength(2);
    expect(settleShowdown(state)).toEqual(winners);
    expect(winner.stack).toBe(paidStack);

    cleanupShowdown(state);

    expect(state.phase).toBe("waiting");
    expect(state.communityCards).toEqual([]);
    expect(state.lastWinners).toEqual([]);
    expect(state.showdownPot).toBeNull();
    expect(state.showdownSeatIndexes).toEqual([]);
    expect(state.seats.every((seat) => !seat?.cards)).toBe(true);
  });

  test("conserves every cent across main and side-pot ties", () => {
    const state = makeState({
      communityCards: ["AS", "KS", "QS", "JS", "TS"],
      dealerSeatIndex: 2,
      deck: [],
      phase: "showdown",
    });
    prepareSeat(state, 0, {
      cards: ["2C", "3D"],
      committed: 0.03,
      stack: 1,
    });
    prepareSeat(state, 1, {
      cards: ["4C", "5D"],
      committed: 0.05,
      stack: 1,
    });
    prepareSeat(state, 2, {
      cards: ["6C", "7D"],
      committed: 0.05,
      stack: 1,
    });
    const before = totalChips(state);

    const winners = settleShowdown(state);

    expect(winners.reduce((sum, winner) => sum + winner.amount, 0)).toBeCloseTo(
      0.13
    );
    expect(totalChips(state)).toBe(before);
    expect(state.seats.every((seat) => !seat || seat.committed === 0)).toBe(
      true
    );
  });
});
