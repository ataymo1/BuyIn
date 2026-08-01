import { expect, test } from "@playwright/test";
import {
  signLivePokerToken,
  verifyLivePokerToken,
} from "../src/lib/live-poker/auth";
import { createInitialState } from "../src/lib/live-poker/engine";
import { toPublicState } from "../src/lib/live-poker/types";

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
