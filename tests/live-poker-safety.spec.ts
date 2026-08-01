import { expect, test } from "@playwright/test";
import {
  signLivePokerToken,
  verifyLivePokerToken,
} from "../src/lib/live-poker/auth";
import { createInitialState, seatPlayer } from "../src/lib/live-poker/engine";
import {
  clientMessageSchema,
  toPublicState,
} from "../src/lib/live-poker/types";

const config = {
  bigBlind: 2,
  hostUserId: "host-user",
  maxBuyIn: 400,
  minBuyIn: 20,
  seatCount: 6,
  smallBlind: 1,
};

test("public winner state omits internal user ids", () => {
  const state = createInitialState(config);
  state.lastWinners = [
    {
      amount: 40,
      playerId: "player-1",
      seatIndex: 0,
      userId: "private-user-id",
    },
  ];

  const publicState = toPublicState(state, "viewer");
  expect(publicState.lastWinners).toEqual([
    { amount: 40, playerId: "player-1", seatIndex: 0 },
  ]);
  expect(publicState.lastWinners[0]).not.toHaveProperty("userId");
});

test("ready state and manual starts are absent from the public protocol", () => {
  const state = createInitialState(config);
  seatPlayer(state, 0, {
    buyIn: 100,
    name: "Legacy Player",
    playerId: "player-legacy",
    userId: "user-legacy",
  });
  const legacySeat = state.seats[0] as NonNullable<(typeof state.seats)[0]> & {
    ready?: boolean;
  };
  legacySeat.ready = true;

  const publicSeat = toPublicState(state, legacySeat.userId).seats[0];
  expect(publicSeat).not.toHaveProperty("ready");
  expect(clientMessageSchema.safeParse({ type: "startHand" }).success).toBe(
    false
  );
  expect(
    clientMessageSchema.safeParse({ ready: true, type: "ready" }).success
  ).toBe(false);
  expect(
    clientMessageSchema.safeParse({
      paused: true,
      type: "setTablePaused",
    }).success
  ).toBe(true);
  expect(toPublicState(state, legacySeat.userId).gamePaused).toBe(true);
});

test("live poker JWTs require the dedicated configured secret", async () => {
  const previousLivePokerSecret = process.env.LIVE_POKER_JWT_SECRET;
  const previousNextAuthSecret = process.env.NEXTAUTH_SECRET;

  try {
    Reflect.deleteProperty(process.env, "LIVE_POKER_JWT_SECRET");
    process.env.NEXTAUTH_SECRET = "must-not-be-used-as-a-fallback";
    await expect(
      signLivePokerToken({
        exp: Math.floor(Date.now() / 1000) + 60,
        playerId: "player-1",
        playerName: "Player",
        tableConfig: config,
        tableId: "table-1",
        userId: "user-1",
      })
    ).rejects.toThrow("LIVE_POKER_JWT_SECRET is not configured");

    process.env.LIVE_POKER_JWT_SECRET = "test-live-poker-secret";
    const token = await signLivePokerToken({
      exp: Math.floor(Date.now() / 1000) + 60,
      playerId: "player-1",
      playerName: "Player",
      tableConfig: config,
      tableId: "table-1",
      userId: "user-1",
    });
    await expect(verifyLivePokerToken(token)).resolves.toMatchObject({
      tableConfig: config,
      tableId: "table-1",
      userId: "user-1",
    });
  } finally {
    if (previousLivePokerSecret === undefined) {
      Reflect.deleteProperty(process.env, "LIVE_POKER_JWT_SECRET");
    } else {
      process.env.LIVE_POKER_JWT_SECRET = previousLivePokerSecret;
    }
    if (previousNextAuthSecret === undefined) {
      Reflect.deleteProperty(process.env, "NEXTAUTH_SECRET");
    } else {
      process.env.NEXTAUTH_SECRET = previousNextAuthSecret;
    }
  }
});
