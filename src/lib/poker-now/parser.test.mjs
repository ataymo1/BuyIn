import assert from "node:assert/strict";
import test from "node:test";
import { parseLegacyPokerNowLog } from "./legacy-log-parser.ts";
import { parsePokerNowLedger } from "./parser.ts";

const HEADERS =
  "player_nickname,player_id,session_start_at,session_end_at,buy_in,buy_out,stack,nit_escrow,net";
const HEADERS_WITHOUT_NIT_ESCROW =
  "player_nickname,player_id,session_start_at,session_end_at,buy_in,buy_out,stack,net";
const INVALID_LEDGER = /does not look like a PokerNow ledger CSV/;
const UNBALANCED_TOTALS = /totals that do not balance/;

test("aggregates repeated ledger sessions by PokerNow player ID", () => {
  const ledger = [
    HEADERS,
    '"Alex, Jr.",player-a,2026-08-26T06:40:29.687Z,,5000,,6050,0,1050',
    '"Blair",player-b,2026-08-26T06:10:46.798Z,,5000,,18450,0,13450',
    '"Alex",player-a,2026-08-26T05:17:52.143Z,2026-08-26T06:39:41.592Z,2500,0,0,0,-2500',
    '"Casey",player-c,2026-08-26T05:17:52.139Z,2026-08-26T05:32:37.389Z,7500,3722,0,0,-3778',
  ].join("\r\n");

  const session = parsePokerNowLedger(ledger, "ledger_pglExampleGame (1).csv");

  assert.equal(session.sourceId, "pglExampleGame");
  assert.equal(session.startedAt, Date.parse("2026-08-26T05:17:52.139Z"));
  assert.equal(session.endedAt, Date.parse("2026-08-26T06:40:29.687Z"));
  assert.equal(session.handCount, 0);
  assert.deepEqual(session.players, [
    {
      sourceId: "player-a",
      name: "Alex, Jr.",
      buyIn: 7500,
      cashOut: 6050,
    },
    {
      sourceId: "player-b",
      name: "Blair",
      buyIn: 5000,
      cashOut: 18_450,
    },
    {
      sourceId: "player-c",
      name: "Casey",
      buyIn: 7500,
      cashOut: 3722,
    },
  ]);
});

test("includes nit escrow in cash-out totals", () => {
  const ledger = [
    HEADERS,
    '"Alex",player-a,2026-08-26T07:01:34.408Z,2026-08-26T07:07:37.687Z,2500,2000,0,500,0',
    '"Blair",player-b,2026-08-26T07:01:34.404Z,,2500,,5000,0,2500',
  ].join("\n");

  const session = parsePokerNowLedger(ledger, "ledger_pglSecondGame.csv");

  assert.equal(session.sourceId, "pglSecondGame");
  assert.deepEqual(
    session.players.map(({ sourceId, buyIn, cashOut }) => ({
      sourceId,
      buyIn,
      cashOut,
    })),
    [
      { sourceId: "player-a", buyIn: 2500, cashOut: 2500 },
      { sourceId: "player-b", buyIn: 2500, cashOut: 5000 },
    ]
  );
});

test("accepts non-nit ledgers without a nit escrow column", () => {
  const ledger = [
    HEADERS_WITHOUT_NIT_ESCROW,
    '"Alex",player-a,2026-08-26T07:01:34.408Z,2026-08-26T07:07:37.687Z,2500,2500,0,0',
    '"Blair",player-b,2026-08-26T07:01:34.404Z,,2500,,5000,2500',
  ].join("\n");

  const session = parsePokerNowLedger(ledger, "ledger_pglNoNit.csv");

  assert.deepEqual(
    session.players.map(({ sourceId, cashOut }) => ({ sourceId, cashOut })),
    [
      { sourceId: "player-a", cashOut: 2500 },
      { sourceId: "player-b", cashOut: 5000 },
    ]
  );
});

test("retains legacy log behavior for assignment recovery", () => {
  const log = [
    "entry,at",
    '"The admin approved the player ""Alex @ player-a"" participation with a stack of 100",2026-08-26T05:00:00.000Z',
    '"""Alex @ player-a"" quits the game with a stack of 125",2026-08-26T05:30:00.000Z',
    '"The admin approved the player ""Blair @ player-b"" participation with a stack of 100",2026-08-26T05:01:00.000Z',
    '"""Blair @ player-b"" quits the game with a stack of 100",2026-08-26T05:31:00.000Z',
    '"The admin approved the player ""Alex @ player-a"" participation with a stack of 50",2026-08-26T06:00:00.000Z',
    '"""Alex @ player-a"" quits the game with a stack of 25",2026-08-26T06:30:00.000Z',
  ].join("\n");

  const session = parseLegacyPokerNowLog(
    log,
    "poker_now_log_pglLegacy (1).csv"
  );

  assert.equal(session.sourceId, "pglLegacy (1)");
  assert.deepEqual(session.players, [
    { sourceId: "player-a", name: "Alex", buyIn: 150, cashOut: 25 },
    { sourceId: "player-b", name: "Blair", buyIn: 100, cashOut: 100 },
  ]);
});

test("rejects a PokerNow game log instead of partially importing it", () => {
  assert.throws(
    () =>
      parsePokerNowLedger(
        'entry,at\n"-- starting hand #1",2026-08-26T07:01:34.408Z',
        "poker_now_log_pglExample.csv"
      ),
    INVALID_LEDGER
  );
});

test("rejects ledger rows whose reported totals do not balance", () => {
  const ledger = [
    HEADERS,
    '"Alex",player-a,2026-08-26T07:01:34.408Z,,2500,,3000,0,100',
  ].join("\n");

  assert.throws(
    () => parsePokerNowLedger(ledger, "ledger_pglExample.csv"),
    UNBALANCED_TOTALS
  );
});
