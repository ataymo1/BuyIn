import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  canUserManageGame,
  deleteGameCascade,
  getPlayerDisplaySummary,
  getUserDisplaySummary,
  requireGameManager,
} from "./helpers";
import { ensureCurrentSeason } from "./seasons";

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
    seasonId: v.optional(v.id("seasons")),
    status: v.optional(
      v.union(
        v.literal("ACTIVE"),
        v.literal("COMPLETED"),
        v.literal("CANCELLED")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.groupId && !args.groupIds.includes(args.groupId)) {
      throw new Error("Group is not in the user's memberships");
    }

    let games: Doc<"games">[] = await (async () => {
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

    if (args.seasonId) {
      if (!args.groupId) {
        throw new Error("A group is required when filtering by season");
      }
      const season = await ctx.db.get(args.seasonId);
      if (!season || season.groupId !== args.groupId) {
        throw new Error("Season does not belong to this group");
      }
      games = games.filter(
        (game) =>
          game.seasonId === args.seasonId ||
          (!game.seasonId && season.number === 1)
      );
    }

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
    groupId: v.id("groups"),
    createdById: v.id("users"),
  },
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

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    const season = await ensureCurrentSeason(ctx, group);

    return await ctx.db.insert("games", {
      date: args.date,
      location: args.location,
      notes: args.notes,
      gameType: args.gameType,
      groupId: args.groupId,
      seasonId: season._id,
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
    await ctx.db.patch(gameId, updates);
    return await ctx.db.get(gameId);
  },
});

// Delete game (owner or banker)
export const deleteGame = mutation({
  args: { gameId: v.id("games"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    await requireGameManager(
      ctx,
      game,
      args.userId,
      "Only the group owner or session banker can delete games"
    );

    await deleteGameCascade(ctx, args.gameId);
  },
});

// Join game (add player to game)
export const joinGame = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.status !== "ACTIVE") {
      throw new Error("Only active sessions can be joined");
    }

    const player = await ctx.db.get(args.playerId);
    if (!player || player.userId !== args.userId) {
      throw new Error("You can only join a session as your own player");
    }
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", game.groupId).eq("userId", args.userId)
      )
      .first();
    if (!membership) {
      throw new Error("Only group members can join sessions");
    }

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
    userId: v.id("users"),
    buyIn: v.optional(v.number()),
    cashOut: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const gamePlayer = await ctx.db.get(args.gamePlayerId);
    if (!gamePlayer) {
      throw new Error("Game player not found");
    }
    const game = await ctx.db.get(gamePlayer.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    await requireGameManager(
      ctx,
      game,
      args.userId,
      "Only the group owner or session banker can edit player totals"
    );

    const buyIn = args.buyIn ?? gamePlayer.buyIn;
    const cashOut = args.cashOut ?? gamePlayer.cashOut;
    if (buyIn < 0 || (cashOut !== undefined && cashOut < 0)) {
      throw new Error("Amounts must be non-negative");
    }

    await ctx.db.patch(args.gamePlayerId, {
      buyIn,
      cashOut,
      profit: cashOut === undefined ? undefined : cashOut - buyIn,
    });
    return await ctx.db.get(args.gamePlayerId);
  },
});
