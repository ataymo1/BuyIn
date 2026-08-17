import { expect, test } from "@playwright/test";
import {
  getLivePokerReconnectDelay,
  LIVE_POKER_MAX_RECONNECT_DELAY_MS,
} from "../src/lib/live-poker/reconnect";
import { livePokerTableFormSchema } from "../src/lib/live-poker/table-form-schema";

const validTable = {
  title: " Friday Game ",
  smallBlind: "1",
  bigBlind: "2",
  minBuyIn: "20",
  maxBuyIn: "400",
  seatCount: "6",
};

test.describe("live poker resilience helpers", () => {
  test("uses capped exponential reconnect delays", () => {
    expect([0, 1, 2, 3, 4].map(getLivePokerReconnectDelay)).toEqual([
      1000, 2000, 4000, 8000, 16_000,
    ]);
    expect(getLivePokerReconnectDelay(20)).toBe(
      LIVE_POKER_MAX_RECONNECT_DELAY_MS
    );
  });

  test("parses valid table settings into finite numbers", () => {
    const result = livePokerTableFormSchema.parse(validTable);

    expect(result).toEqual({
      title: "Friday Game",
      smallBlind: 1,
      bigBlind: 2,
      minBuyIn: 20,
      maxBuyIn: 400,
      seatCount: 6,
    });
  });

  test("rejects invalid numeric and cross-field table settings", () => {
    expect(
      livePokerTableFormSchema.safeParse({
        ...validTable,
        bigBlind: "0.5",
        maxBuyIn: "10",
        seatCount: "6.5",
      }).success
    ).toBe(false);
    for (const smallBlind of [
      "1e309",
      "0x10",
      "not-a-number",
      "0.001",
      String(Number.MAX_SAFE_INTEGER),
    ]) {
      expect(
        livePokerTableFormSchema.safeParse({
          ...validTable,
          smallBlind,
        }).success
      ).toBe(false);
    }
    expect(
      livePokerTableFormSchema.safeParse({
        ...validTable,
        maxBuyIn: "0",
      }).success
    ).toBe(false);
  });
});
