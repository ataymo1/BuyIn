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
const MISSING_START_WARNING = /Old account has no session start/;
const MISSING_TIMESTAMPS_WARNING = /no session timestamps/;
const NO_SESSION_DATE =
  /no session timestamps.*Add a session start or end time/;
const INVALID_START = /row 2.*invalid session start/;
const INVALID_END = /row 2.*invalid session end/;
const REVERSED_TIMESTAMPS = /ends before/;
const NEGATIVE_AMOUNT = /negative chip amount/;
const INVALID_NET = /invalid net/;
const MISSING_BUY_IN = /missing buy-in/;

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

test("imports an end-only refunded row without losing its money or identity", () => {
  const ledger = [
    HEADERS,
    '"New account",new-id,2026-09-29T03:11:02.702Z,,100,,2189,0,2089',
    '"Old account",old-id,,2026-09-29T03:10:45.717Z,100,100,0,0,0',
    '"Returning player",returning-id,2026-09-29T03:11:02.686Z,2026-09-29T06:26:32.265Z,500,0,0,0,-500',
    '"Returning player",returning-id,2026-09-29T06:32:08.934Z,2026-09-29T08:23:11.182Z,200,0,0,0,-200',
  ].join("\n");

  const session = parsePokerNowLedger(ledger, "Poker Now Ledger (3).csv");

  assert.equal(session.startedAt, Date.parse("2026-09-29T03:10:45.717Z"));
  assert.equal(session.endedAt, Date.parse("2026-09-29T08:23:11.182Z"));
  assert.deepEqual(session.players, [
    { sourceId: "new-id", name: "New account", buyIn: 100, cashOut: 2189 },
    { sourceId: "old-id", name: "Old account", buyIn: 100, cashOut: 100 },
    {
      sourceId: "returning-id",
      name: "Returning player",
      buyIn: 700,
      cashOut: 0,
    },
  ]);
  assert.equal(session.warnings.length, 1);
  assert.equal(session.warnings[0].rowNumber, 3);
  assert.match(session.warnings[0].message, MISSING_START_WARNING);
});

test("accepts all end-only rows and derives finite session boundaries", () => {
  const session = parsePokerNowLedger(
    [
      HEADERS,
      '"Alex",a, ,2026-09-29T04:00:00.000Z,100,120,0,0,20',
      '"Blair",b,,2026-09-29T03:00:00.000Z,100,80,0,0,-20',
    ].join("\n")
  );

  assert.equal(session.startedAt, Date.parse("2026-09-29T03:00:00.000Z"));
  assert.equal(session.endedAt, Date.parse("2026-09-29T04:00:00.000Z"));
  assert.equal(session.warnings.length, 2);
  assert.equal(
    session.players.reduce((sum, p) => sum + p.cashOut, 0),
    200
  );
});

test("keeps undated rows but prefers a dated nickname regardless of row order", () => {
  const rows = [
    '"Old name",a,,,100,100,0,0,0',
    '"New name",a,2026-09-29T03:00:00.000Z,,100,,120,0,20',
    '"Blair",b,2026-09-29T04:00:00.000Z,,100,,80,0,-20',
  ];

  for (const orderedRows of [rows, [...rows].reverse()]) {
    const session = parsePokerNowLedger([HEADERS, ...orderedRows].join("\n"));

    assert.equal(session.startedAt, Date.parse("2026-09-29T03:00:00.000Z"));
    assert.equal(session.endedAt, Date.parse("2026-09-29T04:00:00.000Z"));
    assert.deepEqual(
      session.players.find((p) => p.sourceId === "a"),
      {
        sourceId: "a",
        name: "New name",
        buyIn: 200,
        cashOut: 220,
      }
    );
    assert.equal(session.warnings.length, 1);
    assert.match(session.warnings[0].message, MISSING_TIMESTAMPS_WARNING);
  }
});

test("uses the end time to order aliases when a start time is missing", () => {
  const rows = [
    '"New name",a,,2026-09-29T04:00:00.000Z,100,120,0,0,20',
    '"Old name",a,2026-09-29T03:00:00.000Z,2026-09-29T03:30:00.000Z,100,80,0,0,-20',
  ];
  for (const orderedRows of [rows, [...rows].reverse()]) {
    const session = parsePokerNowLedger([HEADERS, ...orderedRows].join("\n"));
    assert.deepEqual(session.players, [
      { sourceId: "a", name: "New name", buyIn: 200, cashOut: 200 },
    ]);
  }
});

test("requires at least one timestamp instead of inventing a session date", () => {
  assert.throws(
    () => parsePokerNowLedger(`${HEADERS}\n"Alex",a,,,100,100,0,0,0`),
    NO_SESSION_DATE
  );
});

test("does not warn for ordinary open sessions with a known start time", () => {
  const session = parsePokerNowLedger(
    `${HEADERS}\n"Alex",a,2026-09-29T03:00:00.000Z,,100,,120,0,20`
  );
  assert.deepEqual(session.warnings, []);
});

test("still rejects malformed timestamps and reversed known boundaries", () => {
  for (const [start, end, error] of [
    ["invalid", "2026-09-29T03:00:00.000Z", INVALID_START],
    ["", "invalid", INVALID_END],
    [
      "2026-09-29T04:00:00.000Z",
      "2026-09-29T03:00:00.000Z",
      REVERSED_TIMESTAMPS,
    ],
  ]) {
    assert.throws(
      () =>
        parsePokerNowLedger(
          `${HEADERS}\n"Alex",a,${start},${end},100,100,0,0,0`
        ),
      error
    );
  }
});

test("missing timing does not bypass financial validation", () => {
  for (const [amounts, error] of [
    ["100,100,0,0,10", UNBALANCED_TOTALS],
    ["-100,100,0,0,200", NEGATIVE_AMOUNT],
    ["100,,0,0,NaN", INVALID_NET],
    [",100,0,0,0", MISSING_BUY_IN],
  ]) {
    assert.throws(
      () =>
        parsePokerNowLedger(
          `${HEADERS}\n"Alex",a,,2026-09-29T03:00:00.000Z,${amounts}`
        ),
      error
    );
  }
});
