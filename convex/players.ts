import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get player by user ID
export const getPlayerByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Get player by ID
export const getPlayer = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      return null;
    }

    const user = player.userId ? await ctx.db.get(player.userId) : null;
    return {
      ...player,
      id: player._id,
      user: user
        ? {
            id: user._id,
            name: user.name,
            email: user.email,
            image: user.image,
          }
        : null,
    };
  },
});

// Get player with stats
export const getPlayerWithStats = query({
  args: {
    playerId: v.id("players"),
    groupIds: v.optional(v.array(v.id("groups"))),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      return null;
    }

    const user = player.userId ? await ctx.db.get(player.userId) : null;

    // Get all game players for this player
    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();

    // Filter by group if specified
    let filteredGamePlayers = gamePlayers;
    if (args.groupIds && args.groupIds.length > 0) {
      const gamesInGroups = await Promise.all(
        args.groupIds.map((gId) =>
          ctx.db
            .query("games")
            .withIndex("by_groupId", (q) => q.eq("groupId", gId))
            .collect()
        )
      );
      const gameIdsInGroups = new Set(gamesInGroups.flat().map((g) => g._id));
      filteredGamePlayers = gamePlayers.filter((gp) =>
        gameIdsInGroups.has(gp.gameId)
      );
    }

    const gamesPlayed = filteredGamePlayers.length;
    const totalBuyIn = filteredGamePlayers.reduce(
      (sum, gp) => sum + gp.buyIn,
      0
    );
    const totalCashOut = filteredGamePlayers.reduce(
      (sum, gp) => sum + (gp.cashOut ?? 0),
      0
    );
    const totalProfit = totalCashOut - totalBuyIn;

    return {
      ...player,
      id: player._id,
      user,
      stats: {
        gamesPlayed,
        totalBuyIn,
        totalCashOut,
        totalProfit,
      },
    };
  },
});

// Get all players
export const getPlayers = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    return players.map((p) => ({ ...p, id: p._id }));
  },
});

// Create player
export const createPlayer = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("players", {
      name: args.name,
      email: args.email,
      userId: args.userId,
    });
  },
});

// Update player
export const updatePlayer = mutation({
  args: {
    playerId: v.id("players"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { playerId, ...updates } = args;
    await ctx.db.patch(playerId, updates);
    return await ctx.db.get(playerId);
  },
});

// Create or get player for user
export const getOrCreatePlayerForUser = mutation({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("players", {
      name: args.name,
      userId: args.userId,
    });
  },
});
