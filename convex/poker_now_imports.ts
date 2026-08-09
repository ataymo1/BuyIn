// biome-ignore-all lint/style/useFilenamingConvention: Convex exposes underscore filenames as stable API namespaces.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";

const importedPlayer = v.object({
  sourcePlayerId: v.string(),
  displayName: v.string(),
  buyIn: v.number(),
  cashOut: v.number(),
  playerId: v.optional(v.id("players")),
});

type ImportedPlayer = Doc<"pokerNowImportRequests">["players"][number];
interface ImportData {
  groupId: Id<"groups">;
  createdById: Id<"users">;
  sourceId: string;
  date: number;
  smallBlind?: number;
  bigBlind?: number;
  handCount: number;
  players: ImportedPlayer[];
}

async function findDuplicate(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  sourceId: string
) {
  const game = await ctx.db
    .query("games")
    .withIndex("by_groupId_importSourceId", (q) =>
      q.eq("groupId", groupId).eq("importSourceId", sourceId)
    )
    .first();
  const request = await ctx.db
    .query("pokerNowImportRequests")
    .withIndex("by_groupId_sourceId", (q) =>
      q.eq("groupId", groupId).eq("sourceId", sourceId)
    )
    .filter((q) => q.eq(q.field("status"), "PENDING"))
    .first();
  return game ?? request;
}

async function persistSession(ctx: MutationCtx, args: ImportData) {
  const totalsByPlayer = new Map<
    Id<"players">,
    { buyIn: number; cashOut: number }
  >();

  for (const imported of args.players) {
    if (
      !(Number.isFinite(imported.buyIn) && Number.isFinite(imported.cashOut))
    ) {
      throw new Error("Player totals must be valid numbers");
    }
    let playerId = imported.playerId;
    if (playerId && !(await ctx.db.get(playerId))) {
      throw new Error("A selected player no longer exists");
    }
    playerId ??= await ctx.db.insert("players", {
      name: imported.displayName.trim(),
    });

    const priorAlias = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId_sourcePlayerId", (q) =>
        q
          .eq("groupId", args.groupId)
          .eq("sourcePlayerId", imported.sourcePlayerId)
      )
      .first();
    if (priorAlias) {
      await ctx.db.patch(priorAlias._id, {
        playerId,
        displayName: imported.displayName.trim(),
      });
    } else {
      await ctx.db.insert("pokerNowAliases", {
        groupId: args.groupId,
        sourcePlayerId: imported.sourcePlayerId,
        displayName: imported.displayName.trim(),
        playerId,
      });
    }

    const totals = totalsByPlayer.get(playerId) ?? { buyIn: 0, cashOut: 0 };
    totals.buyIn += imported.buyIn;
    totals.cashOut += imported.cashOut;
    totalsByPlayer.set(playerId, totals);
  }

  if (totalsByPlayer.size < 2) {
    throw new Error("An imported session needs at least two different players");
  }

  const gameId = await ctx.db.insert("games", {
    date: args.date,
    location: "PokerNow",
    notes: `Imported from PokerNow · ${args.handCount} hands${
      args.smallBlind && args.bigBlind
        ? ` · ${args.smallBlind}/${args.bigBlind} blinds`
        : ""
    }`,
    status: "COMPLETED",
    gameType: "cash",
    groupId: args.groupId,
    createdById: args.createdById,
    importSource: "POKER_NOW",
    importSourceId: args.sourceId,
    smallBlind: args.smallBlind,
    bigBlind: args.bigBlind,
  });

  for (const [playerId, totals] of totalsByPlayer) {
    const buyIn = Math.round(totals.buyIn * 100) / 100;
    const cashOut = Math.round(totals.cashOut * 100) / 100;
    await ctx.db.insert("gamePlayers", {
      gameId,
      playerId,
      buyIn,
      cashOut,
      profit: Math.round((cashOut - buyIn) * 100) / 100,
    });
    for (const transaction of [
      { type: "buyin" as const, amount: buyIn },
      { type: "cashout" as const, amount: cashOut },
    ]) {
      await ctx.db.insert("transactions", {
        gameId,
        playerId,
        ...transaction,
        description: "Imported from PokerNow",
        createdById: args.createdById,
        status: "APPROVED",
      });
    }
  }
  return gameId;
}

export const getCandidates = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    const memberPlayers = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        const player = await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", member.userId))
          .first();
        return player
          ? { id: player._id, name: player.name, email: user?.email }
          : null;
      })
    );
    const aliases = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    return {
      players: memberPlayers.filter((player) => player !== null),
      aliases,
    };
  },
});

export const getPendingRequests = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (group?.ownerId !== args.userId) {
      return [];
    }
    const requests = await ctx.db
      .query("pokerNowImportRequests")
      .withIndex("by_groupId_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "PENDING")
      )
      .collect();
    return await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requestedById);
        return {
          ...request,
          requesterName: requester?.name ?? requester?.email ?? "Group member",
        };
      })
    );
  },
});

export const createSession = mutation({
  args: {
    groupId: v.id("groups"),
    createdById: v.id("users"),
    sourceId: v.string(),
    date: v.number(),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    handCount: v.number(),
    players: v.array(importedPlayer),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.createdById)
      )
      .first();
    if (!membership) {
      throw new Error("Only group members can import sessions");
    }
    if (await findDuplicate(ctx, args.groupId, args.sourceId)) {
      throw new Error(
        "This PokerNow log has already been imported or is awaiting approval"
      );
    }
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    if (group.ownerId === args.createdById) {
      const gameId = await persistSession(ctx, args);
      return { status: "APPROVED" as const, gameId };
    }
    const requestId = await ctx.db.insert("pokerNowImportRequests", {
      groupId: args.groupId,
      requestedById: args.createdById,
      sourceId: args.sourceId,
      date: args.date,
      smallBlind: args.smallBlind,
      bigBlind: args.bigBlind,
      handCount: args.handCount,
      players: args.players,
      status: "PENDING",
      requestedAt: Date.now(),
    });
    return { status: "PENDING" as const, requestId };
  },
});

export const respondToRequest = mutation({
  args: {
    requestId: v.id("pokerNowImportRequests"),
    userId: v.id("users"),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "PENDING") {
      throw new Error("Import request not found");
    }
    const group = await ctx.db.get(request.groupId);
    if (group?.ownerId !== args.userId) {
      throw new Error("Only the group leader can review imports");
    }
    if (!args.approve) {
      await ctx.db.patch(request._id, {
        status: "REJECTED",
        respondedAt: Date.now(),
        respondedById: args.userId,
      });
      return null;
    }
    if (await findDuplicate(ctx, request.groupId, request.sourceId)) {
      const existingGame = await ctx.db
        .query("games")
        .withIndex("by_groupId_importSourceId", (q) =>
          q
            .eq("groupId", request.groupId)
            .eq("importSourceId", request.sourceId)
        )
        .first();
      if (existingGame) {
        throw new Error("This PokerNow log has already been imported");
      }
    }
    const gameId = await persistSession(ctx, {
      groupId: request.groupId,
      createdById: request.requestedById,
      sourceId: request.sourceId,
      date: request.date,
      smallBlind: request.smallBlind,
      bigBlind: request.bigBlind,
      handCount: request.handCount,
      players: request.players,
    });
    await ctx.db.patch(request._id, {
      status: "APPROVED",
      respondedAt: Date.now(),
      respondedById: args.userId,
      gameId,
    });
    return gameId;
  },
});
