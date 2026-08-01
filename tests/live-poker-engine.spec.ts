import { expect, test } from "@playwright/test";
import {
  applyAction,
  createInitialState,
  seatPlayer,
  settleShowdown,
  startHand,
} from "../src/lib/live-poker/engine";
import type {
  LivePokerSeat,
  LivePokerState,
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
    expect(state.phase).toBe("showdown");
    expect(state.communityCards).toHaveLength(5);
  });

  test("runs directly to showdown when blinds leave no actionable players", () => {
    const state = makeState({ seatCount: 2, seats: [null, null] });
    addSeat(state, 0, 3, true);
    addSeat(state, 1, 7, true);

    startHand(state);

    expect(state.currentBet).toBe(10);
    expect(state.seats[0]?.isAllIn).toBe(true);
    expect(state.seats[1]?.isAllIn).toBe(true);
    expect(state.activeSeatIndex).toBeNull();
    expect(state.phase).toBe("showdown");
    expect(state.communityCards).toHaveLength(5);
  });

  test("runs out the board when only a matched big blind still has chips", () => {
    const state = makeState({ seatCount: 2, seats: [null, null] });
    addSeat(state, 0, 3, true);
    addSeat(state, 1, 100, true);

    startHand(state);

    expect(state.seats[0]?.isAllIn).toBe(true);
    expect(state.seats[1]?.isAllIn).toBe(false);
    expect(state.seats[1]?.bet).toBe(10);
    expect(state.activeSeatIndex).toBeNull();
    expect(state.phase).toBe("showdown");
    expect(state.communityCards).toHaveLength(5);
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
