import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  canUserManageGame,
  deleteGameCascade,
  getPlayerDisplaySummary,
  getUserDisplaySummary,
  isUserGroupMember,
  requireGameManager,
} from "./helpers";

// Query to check if user can manage a game (is group owner or session banker)
export const canManageGame = query({
  args: { gameId: v.id("games"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      return false;
    }

    return await canUserManageGame(ctx, game, args.userId);
  },
});

// Get games for user's groups
export const getGames = query({
  args: {
    groupIds: v.array(v.id("groups")),
    groupId: v.optional(v.id("groups")),
    status: v.optional(
      v.union(
        v.literal("ACTIVE"),
        v.literal("COMPLETED"),
        v.literal("CANCELLED")
      )
    ),
  },
  handler: async (ctx, args) => {
    const games: Doc<"games">[] = await (async () => {
      if (args.groupId && args.status) {
        const { groupId, status } = args;
        return await ctx.db
          .query("games")
          .withIndex("by_groupId_status", (q) =>
            q.eq("groupId", groupId).eq("status", status)
          )
          .collect();
      }

      if (args.groupId) {
        const { groupId } = args;
        return await ctx.db
          .query("games")
          .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
          .collect();
      }

      const allGames = await Promise.all(
        args.groupIds.map((gId) =>
          ctx.db
            .query("games")
            .withIndex("by_groupId", (q) => q.eq("groupId", gId))
            .collect()
        )
      );
      return allGames.flat();
    })();

    // Sort by date descending
    games.sort((a, b) => b.date - a.date);

    // Get details for each game
    const gamesWithDetails = await Promise.all(
      games.map(async (game) => {
        const group = await ctx.db.get(game.groupId);
        const createdBy = await getUserDisplaySummary(ctx, game.createdById);
        const gamePlayers = await ctx.db
          .query("gamePlayers")
          .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
          .collect();

        const gamePlayersWithDetails = await Promise.all(
          gamePlayers.map(async (gp) => {
            const player = await getPlayerDisplaySummary(ctx, gp.playerId);
            return {
              ...gp,
              player,
            };
          })
        );

        const transactions = await ctx.db
          .query("transactions")
          .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
          .collect();

        return {
          ...game,
          id: game._id,
          group: group ? { id: group._id, name: group.name } : null,
          createdBy,
          gamePlayers: gamePlayersWithDetails,
          transactions,
        };
      })
    );

    return gamesWithDetails;
  },
});

// Get single game with all details
export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      return null;
    }

    const group = await ctx.db.get(game.groupId);
    const createdBy = await getUserDisplaySummary(ctx, game.createdById);

    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();

    const gamePlayersWithDetails = await Promise.all(
      gamePlayers.map(async (gp) => {
        const player = await getPlayerDisplaySummary(ctx, gp.playerId);
        return {
          ...gp,
          id: gp._id,
          player,
        };
      })
    );

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();

    const transactionsWithDetails = await Promise.all(
      transactions.map(async (tx) => {
        const player = await getPlayerDisplaySummary(ctx, tx.playerId);
        const createdByUser = await getUserDisplaySummary(ctx, tx.createdById);
        return {
          ...tx,
          id: tx._id,
          status: tx.status ?? "APPROVED", // Legacy transactions are considered approved
          player,
          createdBy: createdByUser,
        };
      })
    );

    // Sort transactions by creation time
    transactionsWithDetails.sort((a, b) => b._creationTime - a._creationTime);

    return {
      ...game,
      id: game._id,
      group: group ? { id: group._id, name: group.name } : null,
      createdBy,
      gamePlayers: gamePlayersWithDetails,
      transactions: transactionsWithDetails,
    };
  },
});

// Create game
export const createGame = mutation({
  args: {
    date: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    gameType: v.optional(v.union(v.literal("cash"), v.literal("tournament"))),
    livePokerEnabled: v.optional(v.boolean()),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    minBuyIn: v.optional(v.number()),
    maxBuyIn: v.optional(v.number()),
    seatCount: v.optional(v.number()),
    groupId: v.id("groups"),
    createdById: v.id("users"),
  },
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Creation validates both legacy sessions and optional live-table settings.
  handler: async (ctx, args) => {
    // Verify user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.createdById)
      )
      .first();

    if (!membership) {
      throw new Error("Only group members can create sessions");
    }

    if (args.livePokerEnabled && args.gameType === "tournament") {
      throw new Error("Live poker is currently available for cash games only");
    }

    if (args.livePokerEnabled) {
      if (!(args.smallBlind && args.bigBlind) || args.smallBlind <= 0) {
        throw new Error("Live poker requires positive blinds");
      }
      if (args.bigBlind < args.smallBlind) {
        throw new Error("Big blind must be at least the small blind");
      }
      if (
        !args.seatCount ||
        args.seatCount < 2 ||
        args.seatCount > 9 ||
        !Number.isInteger(args.seatCount)
      ) {
        throw new Error("Live poker tables must have 2 to 9 seats");
      }
      if (
        args.minBuyIn !== undefined &&
        args.maxBuyIn !== undefined &&
        args.maxBuyIn < args.minBuyIn
      ) {
        throw new Error("Max buy-in must be at least the min buy-in");
      }
    }

    return await ctx.db.insert("games", {
      date: args.date,
      location: args.location,
      notes: args.notes,
      gameType: args.gameType,
      livePokerEnabled: args.livePokerEnabled,
      liveStatus: args.livePokerEnabled ? "WAITING" : undefined,
      smallBlind: args.livePokerEnabled ? args.smallBlind : undefined,
      bigBlind: args.livePokerEnabled ? args.bigBlind : undefined,
      minBuyIn: args.livePokerEnabled ? args.minBuyIn : undefined,
      maxBuyIn: args.livePokerEnabled ? args.maxBuyIn : undefined,
      seatCount: args.livePokerEnabled ? args.seatCount : undefined,
      groupId: args.groupId,
      createdById: args.createdById,
      status: "ACTIVE",
    });
  },
});

// Update game status (owner or banker)
export const updateGameStatus = mutation({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    ),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    await requireGameManager(
      ctx,
      game,
      args.userId,
      "Only the group owner or session banker can update the game status"
    );

    await ctx.db.patch(args.gameId, { status: args.status });
    return await ctx.db.get(args.gameId);
  },
});

// Update game details (owner or banker)
export const updateGame = mutation({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    date: v.optional(v.number()),
    gameType: v.optional(v.union(v.literal("cash"), v.literal("tournament"))),
    livePokerEnabled: v.optional(v.boolean()),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    minBuyIn: v.optional(v.number()),
    maxBuyIn: v.optional(v.number()),
    seatCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    await requireGameManager(
      ctx,
      game,
      args.userId,
      "Only the group owner or session banker can edit games"
    );

    const { gameId, userId, ...updates } = args;
    if (updates.livePokerEnabled && updates.gameType === "tournament") {
      throw new Error("Live poker is currently available for cash games only");
    }
    if (updates.livePokerEnabled) {
      const smallBlind = updates.smallBlind ?? game.smallBlind;
      const bigBlind = updates.bigBlind ?? game.bigBlind;
      const seatCount = updates.seatCount ?? game.seatCount;

      if (
        !(smallBlind && bigBlind) ||
        smallBlind <= 0 ||
        bigBlind < smallBlind
      ) {
        throw new Error("Live poker requires valid blinds");
      }
      if (
        !seatCount ||
        seatCount < 2 ||
        seatCount > 9 ||
        !Number.isInteger(seatCount)
      ) {
        throw new Error("Live poker tables must have 2 to 9 seats");
      }
      if (
        updates.minBuyIn !== undefined &&
        updates.maxBuyIn !== undefined &&
        updates.maxBuyIn < updates.minBuyIn
      ) {
        throw new Error("Max buy-in must be at least the min buy-in");
      }
    }

    await ctx.db.patch(gameId, updates);
    return await ctx.db.get(gameId);
  },
});

// Delete game (owner only)
export const deleteGame = mutation({
  args: { gameId: v.id("games"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const group = await ctx.db.get(game.groupId);
    if (!group || group.ownerId !== args.userId) {
      throw new Error("Only group owners can delete games");
    }

    await deleteGameCascade(ctx, args.gameId);
  },
});

// Join game (add player to game)
export const joinGame = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    // Check if already joined
    const existing = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("gamePlayers", {
      gameId: args.gameId,
      playerId: args.playerId,
      buyIn: 0,
    });
  },
});

export const getLivePokerAccess = query({
  args: { gameId: v.id("games"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!(game?.livePokerEnabled && game.status === "ACTIVE")) {
      return null;
    }

    const isMember = await isUserGroupMember(ctx, game.groupId, args.userId);
    if (!isMember) {
      return null;
    }

    const group = await ctx.db.get(game.groupId);
    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      game: {
        id: game._id,
        createdById: game.createdById,
        liveStatus: game.liveStatus ?? "WAITING",
        smallBlind: game.smallBlind ?? 1,
        bigBlind: game.bigBlind ?? 2,
        minBuyIn: game.minBuyIn ?? game.bigBlind ?? 2,
        maxBuyIn: game.maxBuyIn ?? (game.bigBlind ?? 2) * 200,
        seatCount: game.seatCount ?? 6,
      },
      group: group ? { id: group._id, name: group.name } : null,
      player: player ? { id: player._id, name: player.name } : null,
    };
  },
});

export const updateLivePokerStatus = mutation({
  args: {
    gameId: v.id("games"),
    liveStatus: v.union(
      v.literal("WAITING"),
      v.literal("PLAYING"),
      v.literal("PAUSED"),
      v.literal("CLOSED")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, { liveStatus: args.liveStatus });
    return await ctx.db.get(args.gameId);
  },
});

// Get game player
export const getGamePlayer = query({
  args: { gameId: v.id("games"), playerId: v.id("players") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();
  },
});

// Update game player totals
export const updateGamePlayer = mutation({
  args: {
    gamePlayerId: v.id("gamePlayers"),
    buyIn: v.optional(v.number()),
    cashOut: v.optional(v.number()),
    profit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { gamePlayerId, ...updates } = args;
    await ctx.db.patch(gamePlayerId, updates);
    return await ctx.db.get(gamePlayerId);
  },
});
