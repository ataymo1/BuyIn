import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

// Helper to check if user is the owner of a group
async function isGroupOwner(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  userId: Id<"users">
): Promise<boolean> {
  const group = await ctx.db.get(groupId);
  return group?.ownerId === userId;
}

// Query to check if user can manage a game (is group owner or session banker)
export const canManageGame = query({
  args: { gameId: v.id("games"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      return false;
    }
    const isOwner = await isGroupOwner(ctx, game.groupId, args.userId);
    const isBanker = game.createdById === args.userId;
    return isOwner || isBanker;
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
    let games;

    if (args.groupId) {
      if (args.status) {
        games = await ctx.db
          .query("games")
          .withIndex("by_groupId_status", (q) =>
            q.eq("groupId", args.groupId!).eq("status", args.status!)
          )
          .collect();
      } else {
        games = await ctx.db
          .query("games")
          .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId!))
          .collect();
      }
    } else {
      // Get games from all user's groups
      const allGames = await Promise.all(
        args.groupIds.map((gId) =>
          ctx.db
            .query("games")
            .withIndex("by_groupId", (q) => q.eq("groupId", gId))
            .collect()
        )
      );
      games = allGames.flat();
    }

    // Sort by date descending
    games.sort((a, b) => b.date - a.date);

    // Get details for each game
    const gamesWithDetails = await Promise.all(
      games.map(async (game) => {
        const group = await ctx.db.get(game.groupId);
        const createdBy = await ctx.db.get(game.createdById);
        const gamePlayers = await ctx.db
          .query("gamePlayers")
          .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
          .collect();

        const gamePlayersWithDetails = await Promise.all(
          gamePlayers.map(async (gp) => {
            const player = await ctx.db.get(gp.playerId);
            return { ...gp, player };
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
          createdBy: createdBy
            ? {
                id: createdBy._id,
                name: createdBy.name,
                email: createdBy.email,
              }
            : null,
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
    const createdBy = await ctx.db.get(game.createdById);

    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();

    const gamePlayersWithDetails = await Promise.all(
      gamePlayers.map(async (gp) => {
        const player = await ctx.db.get(gp.playerId);
        return {
          ...gp,
          id: gp._id,
          player: player ? { id: player._id, name: player.name } : null,
        };
      })
    );

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();

    const transactionsWithDetails = await Promise.all(
      transactions.map(async (tx) => {
        const player = await ctx.db.get(tx.playerId);
        const createdByUser = await ctx.db.get(tx.createdById);
        return {
          ...tx,
          id: tx._id,
          status: tx.status ?? "APPROVED", // Legacy transactions are considered approved
          player: player ? { id: player._id, name: player.name } : null,
          createdBy: createdByUser
            ? { id: createdByUser._id, name: createdByUser.name }
            : null,
        };
      })
    );

    // Sort transactions by creation time
    transactionsWithDetails.sort((a, b) => b._creationTime - a._creationTime);

    return {
      ...game,
      id: game._id,
      group: group ? { id: group._id, name: group.name } : null,
      createdBy: createdBy
        ? { id: createdBy._id, name: createdBy.name, email: createdBy.email }
        : null,
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

    return await ctx.db.insert("games", {
      date: args.date,
      location: args.location,
      notes: args.notes,
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

    const group = await ctx.db.get(game.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const isOwner = group.ownerId === args.userId;
    const isBanker = game.createdById === args.userId;

    if (!isOwner && !isBanker) {
      throw new Error("Only the group owner or session banker can update the game status");
    }

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
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const group = await ctx.db.get(game.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const isOwner = group.ownerId === args.userId;
    const isBanker = game.createdById === args.userId;

    if (!isOwner && !isBanker) {
      throw new Error("Only the group owner or session banker can edit games");
    }

    const { gameId, userId, ...updates } = args;
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

    // Delete game players
    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const gp of gamePlayers) {
      await ctx.db.delete(gp._id);
    }

    // Delete transactions
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const tx of transactions) {
      await ctx.db.delete(tx._id);
    }

    await ctx.db.delete(args.gameId);
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
