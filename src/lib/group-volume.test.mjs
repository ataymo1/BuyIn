import assert from "node:assert/strict";
import test from "node:test";
import { getCommunityVolume, getGroupVolume } from "../../convex/lib/volume.ts";

// Query double applies index constraints to mutable records so the aggregation
// is exercised again after edits, approvals, deletions, and status changes.
function database(tables) {
  return {
    db: {
      query(table) {
        if (!["groups", "games", "transactions"].includes(table)) {
          throw new Error(`Unexpected table: ${table}`);
        }
        const constraints = [];
        const query = {
          withIndex(name, build) {
            const expected =
              table === "games" ? "by_groupId_status" : "by_gameId";
            if (name !== expected) {
              throw new Error(`Unexpected index: ${name}`);
            }
            const index = {
              eq(field, value) {
                constraints.push([field, value]);
                return index;
              },
            };
            build(index);
            return query;
          },
          collect() {
            return Promise.resolve(
              (tables[table] ?? []).filter((row) =>
                constraints.every(([field, value]) => row[field] === value)
              )
            );
          },
        };
        return query;
      },
    },
  };
}

test("totals approved buy-ins across seasons and legacy games, counting games once", async () => {
  const ctx = database({
    games: [
      {
        _id: "old",
        groupId: "a",
        seasonId: "season-1",
        status: "COMPLETED",
        date: 100,
      },
      {
        _id: "new",
        groupId: "a",
        seasonId: "season-2",
        status: "COMPLETED",
        date: 300,
      },
      { _id: "legacy", groupId: "a", status: "COMPLETED", date: 200 },
      { _id: "active", groupId: "a", status: "ACTIVE", date: 900 },
      { _id: "cancelled", groupId: "a", status: "CANCELLED", date: 1000 },
      { _id: "other", groupId: "b", status: "COMPLETED", date: 800 },
    ],
    transactions: [
      { gameId: "old", type: "buyin", status: "APPROVED", amount: 12.34 },
      { gameId: "old", type: "buyin", status: "APPROVED", amount: 0.1 },
      { gameId: "old", type: "buyin", status: "APPROVED", amount: 0.2 },
      { gameId: "new", type: "buyin", status: "APPROVED", amount: 20.25 },
      { gameId: "legacy", type: "buyin", amount: 5.99 },
      { gameId: "new", type: "buyin", status: "PENDING", amount: 2000 },
      { gameId: "new", type: "buyin", status: "REJECTED", amount: 3000 },
      { gameId: "new", type: "cashout", status: "APPROVED", amount: 5000 },
      { gameId: "legacy", type: "cashout", amount: 6000 },
      { gameId: "active", type: "buyin", amount: 7000 },
      { gameId: "cancelled", type: "buyin", amount: 8000 },
      { gameId: "other", type: "buyin", amount: 9000 },
    ],
  });
  assert.deepEqual(await getGroupVolume(ctx, "a"), {
    totalBuyIns: 38.88,
    completedSessionCount: 3,
    lastCompletedSessionAt: 300,
  });
});

test("empty groups and completed games without buy-ins have distinct session counts", async () => {
  const ctx = database({
    games: [
      { _id: "empty-game", groupId: "a", status: "COMPLETED", date: 100 },
    ],
  });
  assert.deepEqual(await getGroupVolume(ctx, "b"), {
    totalBuyIns: 0,
    completedSessionCount: 0,
    lastCompletedSessionAt: null,
  });
  assert.deepEqual(await getGroupVolume(ctx, "a"), {
    totalBuyIns: 0,
    completedSessionCount: 1,
    lastCompletedSessionAt: 100,
  });
  assert.deepEqual(await getCommunityVolume(database({})), {
    totalBuyIns: 0,
    completedSessionCount: 0,
    groupCount: 0,
  });
});

test("community totals include every group beyond listing and search limits", async () => {
  const groups = Array.from({ length: 55 }, (_, i) => ({ _id: `group-${i}` }));
  const ctx = database({
    groups,
    games: groups.map((group, i) => ({
      _id: `game-${i}`,
      groupId: group._id,
      status: "COMPLETED",
      date: i,
    })),
    transactions: groups.map((_, i) => ({
      gameId: `game-${i}`,
      type: "buyin",
      amount: 0.1,
    })),
  });
  assert.deepEqual(await getCommunityVolume(ctx), {
    totalBuyIns: 5.5,
    completedSessionCount: 55,
    groupCount: 55,
  });
});

test("edits, approvals, deletions, and session status changes update totals", async () => {
  const game = { _id: "game", groupId: "a", status: "ACTIVE", date: 100 };
  const transaction = {
    gameId: "game",
    type: "buyin",
    status: "PENDING",
    amount: 10,
  };
  const tables = {
    groups: [{ _id: "a" }],
    games: [game],
    transactions: [transaction],
  };
  const ctx = database(tables);
  assert.equal((await getCommunityVolume(ctx)).completedSessionCount, 0);
  game.status = "COMPLETED";
  assert.deepEqual(await getCommunityVolume(ctx), {
    totalBuyIns: 0,
    completedSessionCount: 1,
    groupCount: 1,
  });
  transaction.status = "APPROVED";
  assert.equal((await getCommunityVolume(ctx)).totalBuyIns, 10);
  transaction.amount = 15.29;
  assert.equal((await getCommunityVolume(ctx)).totalBuyIns, 15.29);
  tables.transactions = [];
  assert.equal((await getCommunityVolume(ctx)).totalBuyIns, 0);
  game.status = "CANCELLED";
  assert.equal((await getCommunityVolume(ctx)).completedSessionCount, 0);
});

test("imports count their materialized game transactions only", async () => {
  const tables = {
    groups: [{ _id: "a" }],
    games: [],
    transactions: [],
    pokerNowImportRequests: [
      { status: "PENDING", players: [{ buyIn: 1000 }] },
      { status: "REJECTED", players: [{ buyIn: 2000 }] },
    ],
  };
  const ctx = database(tables);
  assert.equal((await getCommunityVolume(ctx)).totalBuyIns, 0);
  // Approval materializes one completed game and its approved transactions.
  tables.pokerNowImportRequests[0].status = "APPROVED";
  tables.games.push({
    _id: "import",
    groupId: "a",
    status: "COMPLETED",
    date: 100,
  });
  tables.transactions.push({
    gameId: "import",
    type: "buyin",
    status: "APPROVED",
    amount: 1000,
  });
  tables.gamePlayers = [{ gameId: "import", buyIn: 1000 }];
  tables.pokerNowSessionPlayers = [{ gameId: "import", buyIn: 1000 }];
  assert.deepEqual(await getCommunityVolume(ctx), {
    totalBuyIns: 1000,
    completedSessionCount: 1,
    groupCount: 1,
  });
});
