/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");

test("discovery and search keep their limits while the summary counts every group", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "owner@example.test" });
    const playerId = await ctx.db.insert("players", { name: "Player" });
    for (let i = 0; i < 55; i++) {
      const groupId = await ctx.db.insert("groups", {
        name: `Volume group ${i}`,
        ownerId: owner,
      });
      const gameId = await ctx.db.insert("games", {
        groupId,
        date: i,
        status: "COMPLETED",
        createdById: owner,
      });
      await ctx.db.insert("transactions", {
        gameId,
        playerId,
        type: "buyin",
        amount: 0.1,
        createdById: owner,
      });
    }
    return owner;
  });
  const summary = await t.query(api.groups.getDiscoveryVolumeSummary, {
    userId,
  });
  expect(summary).toEqual({
    totalBuyIns: 5.5,
    completedSessionCount: 55,
    groupCount: 55,
  });
  const discovery = await t.query(api.groups.getDiscoverableGroups, { userId });
  expect(discovery).toHaveLength(50);
  const search = await t.query(api.groups.searchGroups, {
    userId,
    searchTerm: "Volume",
  });
  expect(search).toHaveLength(20);
  for (const group of [...discovery, ...search]) {
    expect(group).toMatchObject({ totalBuyIns: 0.1, completedSessionCount: 1 });
    expect(group.lastCompletedSessionAt).toBeTypeOf("number");
    expect(group).not.toHaveProperty("transactions");
  }
  expect(
    await t.query(api.groups.searchGroups, { userId, searchTerm: "no-match" })
  ).toEqual([]);
  expect(
    await t.query(api.groups.getDiscoveryVolumeSummary, { userId })
  ).toEqual(summary);
});

test("approving a real import adds volume exactly once; pending and rejected imports add none", async () => {
  const t = convexTest(schema, modules);
  const { owner, member, groupId } = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "owner@example.test" });
    const member = await ctx.db.insert("users", {
      email: "member@example.test",
    });
    const groupId = await ctx.db.insert("groups", {
      name: "Import group",
      ownerId: owner,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: member,
      role: "MEMBER",
      joinedAt: 0,
    });
    return { owner, member, groupId };
  });
  const importArgs = {
    groupId,
    createdById: member,
    date: 1000,
    handCount: 0,
    players: [
      { sourcePlayerId: "a", displayName: "A", buyIn: 10.25, cashOut: 15.5 },
      { sourcePlayerId: "b", displayName: "B", buyIn: 10.25, cashOut: 5 },
    ],
  };
  for (const approve of [false, true]) {
    const result = await t.mutation(api.poker_now_imports.createSession, {
      ...importArgs,
      sourceId: `import-${approve}`,
    });
    if (result.status !== "PENDING") {
      throw new Error("Expected pending import");
    }
    expect(
      await t.query(api.groups.getDiscoveryVolumeSummary, { userId: owner })
    ).toEqual({
      totalBuyIns: 0,
      completedSessionCount: 0,
      groupCount: 1,
    });
    await t.mutation(api.poker_now_imports.respondToRequest, {
      requestId: result.requestId,
      userId: owner,
      approve,
    });
  }
  expect(
    await t.query(api.groups.getDiscoveryVolumeSummary, { userId: owner })
  ).toEqual({
    totalBuyIns: 20.5,
    completedSessionCount: 1,
    groupCount: 1,
  });
  expect(
    (await t.query(api.groups.getDiscoverableGroups, { userId: owner }))[0]
  ).toMatchObject({
    totalBuyIns: 20.5,
    completedSessionCount: 1,
    lastCompletedSessionAt: 1000,
  });
});
