import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const winnerValidator = v.object({
  playerId: v.id("players"),
  userId: v.id("users"),
  seatIndex: v.number(),
  amount: v.number(),
  description: v.optional(v.string()),
});

export const recordCompletedHand = mutation({
  args: {
    gameId: v.optional(v.id("games")),
    tableId: v.optional(v.id("livePokerTables")),
    handNumber: v.number(),
    dealerSeat: v.number(),
    smallBlind: v.number(),
    bigBlind: v.number(),
    communityCards: v.array(v.string()),
    winners: v.array(winnerValidator),
    pot: v.number(),
    actionLog: v.array(v.string()),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    if (!(args.gameId || args.tableId)) {
      throw new Error("A gameId or tableId is required");
    }

    const existing = await ctx.db
      .query("livePokerHands")
      .withIndex(
        args.tableId ? "by_tableId_handNumber" : "by_gameId_handNumber",
        (q) =>
          args.tableId
            ? q.eq("tableId", args.tableId).eq("handNumber", args.handNumber)
            : q.eq("gameId", args.gameId).eq("handNumber", args.handNumber)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("livePokerHands", args);
  },
});

function validateTableSettings(args: {
  bigBlind: number;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}) {
  if (args.smallBlind <= 0 || args.bigBlind < args.smallBlind) {
    throw new Error("Live poker requires valid blinds");
  }
  if (
    args.seatCount < 2 ||
    args.seatCount > 9 ||
    !Number.isInteger(args.seatCount)
  ) {
    throw new Error("Live poker tables must have 2 to 9 seats");
  }
  if (args.minBuyIn < 0 || args.maxBuyIn < args.minBuyIn) {
    throw new Error("Max buy-in must be at least the min buy-in");
  }
}

export const createLivePokerTable = mutation({
  args: {
    title: v.string(),
    createdById: v.id("users"),
    smallBlind: v.number(),
    bigBlind: v.number(),
    minBuyIn: v.number(),
    maxBuyIn: v.number(),
    seatCount: v.number(),
  },
  handler: async (ctx, args) => {
    validateTableSettings(args);

    const now = Date.now();
    return await ctx.db.insert("livePokerTables", {
      title: args.title.trim() || "Untitled Table",
      status: "OPEN",
      liveStatus: "WAITING",
      smallBlind: args.smallBlind,
      bigBlind: args.bigBlind,
      minBuyIn: args.minBuyIn,
      maxBuyIn: args.maxBuyIn,
      seatCount: args.seatCount,
      createdById: args.createdById,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listLivePokerTables = query({
  args: {
    currentUserId: v.optional(v.id("users")),
    includeClosed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const tables = args.includeClosed
      ? await ctx.db.query("livePokerTables").collect()
      : await ctx.db
          .query("livePokerTables")
          .withIndex("by_status", (q) => q.eq("status", "OPEN"))
          .collect();

    const rows = await Promise.all(
      tables.map(async (table) => {
        const createdBy = await ctx.db.get(table.createdById);
        const player = await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", table.createdById))
          .first();
        const tablePlayers = await ctx.db
          .query("livePokerTablePlayers")
          .withIndex("by_tableId", (q) => q.eq("tableId", table._id))
          .collect();
        const isCurrentUserSettled = args.currentUserId
          ? tablePlayers.some(
              (tablePlayer) => tablePlayer.userId === args.currentUserId
            )
          : false;

        return {
          ...table,
          id: table._id,
          createdBy: {
            id: table.createdById,
            name: player?.name ?? createdBy?.name ?? createdBy?.email ?? "Host",
          },
          isCreatedByCurrentUser: table.createdById === args.currentUserId,
          isCurrentUserSettled,
          settledPlayerCount: tablePlayers.length,
        };
      })
    );

    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getLivePokerTable = query({
  args: { tableId: v.id("livePokerTables") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table) {
      return null;
    }

    const createdBy = await ctx.db.get(table.createdById);
    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", table.createdById))
      .first();

    return {
      ...table,
      id: table._id,
      createdBy: {
        id: table.createdById,
        name: player?.name ?? createdBy?.name ?? createdBy?.email ?? "Host",
      },
    };
  },
});

export const getLivePokerAccess = query({
  args: { tableId: v.id("livePokerTables"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table || table.status !== "OPEN") {
      return null;
    }

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      table: {
        id: table._id,
        title: table.title,
        createdById: table.createdById,
        liveStatus: table.liveStatus,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        minBuyIn: table.minBuyIn,
        maxBuyIn: table.maxBuyIn,
        seatCount: table.seatCount,
      },
      player: player ? { id: player._id, name: player.name } : null,
    };
  },
});

export const updateLivePokerStatus = mutation({
  args: {
    tableId: v.id("livePokerTables"),
    liveStatus: v.union(
      v.literal("WAITING"),
      v.literal("PLAYING"),
      v.literal("PAUSED"),
      v.literal("CLOSED")
    ),
  },
  handler: async (ctx, args) => {
    const updates =
      args.liveStatus === "CLOSED"
        ? {
            liveStatus: args.liveStatus,
            status: "CLOSED" as const,
            updatedAt: Date.now(),
          }
        : {
            liveStatus: args.liveStatus,
            updatedAt: Date.now(),
          };

    await ctx.db.patch(args.tableId, updates);
    return await ctx.db.get(args.tableId);
  },
});

export const deleteLivePokerTable = mutation({
  args: {
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table) {
      return;
    }

    if (table.createdById !== args.userId) {
      throw new Error("Only the table creator can delete this table");
    }

    const tablePlayers = await ctx.db
      .query("livePokerTablePlayers")
      .withIndex("by_tableId", (q) => q.eq("tableId", args.tableId))
      .collect();

    for (const tablePlayer of tablePlayers) {
      await ctx.db.delete(tablePlayer._id);
    }

    const hands = await ctx.db
      .query("livePokerHands")
      .withIndex("by_tableId", (q) => q.eq("tableId", args.tableId))
      .collect();

    for (const hand of hands) {
      await ctx.db.delete(hand._id);
    }

    await ctx.db.delete(args.tableId);
  },
});

export const settlePlayerStack = mutation({
  args: {
    gameId: v.optional(v.id("games")),
    tableId: v.optional(v.id("livePokerTables")),
    playerId: v.id("players"),
    userId: v.id("users"),
    buyIn: v.number(),
    cashOut: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.buyIn < 0 || args.cashOut < 0) {
      throw new Error("Amounts must be non-negative");
    }

    if (args.tableId) {
      const tableId = args.tableId;
      const table = await ctx.db.get(tableId);
      if (!table) {
        throw new Error("Table not found");
      }

      const existing = await ctx.db
        .query("livePokerTablePlayers")
        .withIndex("by_tableId_playerId", (q) =>
          q.eq("tableId", tableId).eq("playerId", args.playerId)
        )
        .first();

      const updates = {
        buyIn: args.buyIn,
        cashOut: args.cashOut,
        profit: args.cashOut - args.buyIn,
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, updates);
        return await ctx.db.get(existing._id);
      }

      return await ctx.db.insert("livePokerTablePlayers", {
        tableId,
        playerId: args.playerId,
        userId: args.userId,
        ...updates,
      });
    }

    if (!args.gameId) {
      throw new Error("A gameId or tableId is required");
    }

    const gameId = args.gameId;
    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    let gamePlayer = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", gameId).eq("playerId", args.playerId)
      )
      .first();

    if (!gamePlayer) {
      const gamePlayerId = await ctx.db.insert("gamePlayers", {
        gameId,
        playerId: args.playerId,
        buyIn: 0,
      });
      gamePlayer = await ctx.db.get(gamePlayerId);
    }

    if (!gamePlayer) {
      throw new Error("Unable to create player record for game");
    }

    await ctx.db.patch(gamePlayer._id, {
      buyIn: args.buyIn,
      cashOut: args.cashOut,
      profit: args.cashOut - args.buyIn,
    });

    return await ctx.db.get(gamePlayer._id);
  },
});
