import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

// Get user stats across all their groups
export const getUserStats = query({
  args: { userId: v.id("users"), groupIds: v.array(v.id("groups")) },
  handler: async (ctx, args) => {
    // Get player for user
    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!player || args.groupIds.length === 0) {
      return {
        totalBuyIns: 0,
        totalCashOuts: 0,
        netProfit: 0,
        gamesPlayed: 0,
      };
    }

    // Get all games from user's groups
    const gamesInGroups = await Promise.all(
      args.groupIds.map((gId) =>
        ctx.db
          .query("games")
          .withIndex("by_groupId", (q) => q.eq("groupId", gId))
          .collect()
      )
    );
    const gameIds = new Set(gamesInGroups.flat().map((g) => g._id));

    // Get all game players for this player
    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();

    // Filter to only games in user's groups
    const filteredGamePlayers = gamePlayers.filter((gp) =>
      gameIds.has(gp.gameId)
    );

    const gamesPlayed = filteredGamePlayers.length;
    const totalBuyIns = filteredGamePlayers.reduce(
      (sum, gp) => sum + gp.buyIn,
      0
    );
    const totalCashOuts = filteredGamePlayers.reduce(
      (sum, gp) => sum + (gp.cashOut ?? 0),
      0
    );
    const netProfit = totalCashOuts - totalBuyIns;

    return {
      totalBuyIns,
      totalCashOuts,
      netProfit,
      gamesPlayed,
    };
  },
});

// Get leaderboard for all user's groups
export const getOverallLeaderboard = query({
  args: { groupIds: v.array(v.id("groups")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.groupIds.length === 0) {
      return [];
    }

    // Get all games from groups
    const gamesInGroups = await Promise.all(
      args.groupIds.map((gId) =>
        ctx.db
          .query("games")
          .withIndex("by_groupId", (q) => q.eq("groupId", gId))
          .collect()
      )
    );
    const games = gamesInGroups.flat();
    const gameIds = games.map((g) => g._id);

    // Get all game players
    const allGamePlayers = await Promise.all(
      gameIds.map((gameId) =>
        ctx.db
          .query("gamePlayers")
          .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
          .collect()
      )
    );
    const flatGamePlayers = allGamePlayers.flat();

    // Aggregate by player
    const playerStats: Record<
      string,
      {
        playerId: Id<"players">;
        totalProfit: number;
        gamesPlayed: number;
        totalBuyIn: number;
      }
    > = {};

    for (const gp of flatGamePlayers) {
      const key = gp.playerId as string;
      if (!playerStats[key]) {
        playerStats[key] = {
          playerId: gp.playerId,
          totalProfit: 0,
          gamesPlayed: 0,
          totalBuyIn: 0,
        };
      }
      playerStats[key].totalProfit += gp.profit ?? 0;
      playerStats[key].gamesPlayed += 1;
      playerStats[key].totalBuyIn += gp.buyIn;
    }

    // Get player details and sort
    const leaderboard = await Promise.all(
      Object.values(playerStats).map(async (stat) => {
        const player = await ctx.db.get(stat.playerId);
        let user: { _id: Id<"users">; name?: string; image?: string } | null =
          null;
        if (player?.userId) {
          const fetchedUser = await ctx.db.get(player.userId);
          if (fetchedUser) {
            user = {
              _id: fetchedUser._id,
              name: fetchedUser.name,
              image: fetchedUser.image,
            };
          }
        }
        return {
          player: player
            ? {
                id: player._id,
                name: player.name,
                user: user
                  ? { id: user._id, name: user.name, image: user.image }
                  : null,
              }
            : null,
          totalProfit: stat.totalProfit,
          gamesPlayed: stat.gamesPlayed,
          totalBuyIn: stat.totalBuyIn,
        };
      })
    );

    const sorted = leaderboard
      .filter((l) => l.player)
      .sort((a, b) => b.totalProfit - a.totalProfit);

    return args.limit ? sorted.slice(0, args.limit) : sorted;
  },
});

// Get detailed stats for stats page
export const getDetailedStats = query({
  args: { userId: v.id("users"), groupIds: v.array(v.id("groups")) },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!player || args.groupIds.length === 0) {
      return {
        overview: {
          totalBuyIns: 0,
          totalCashOuts: 0,
          netProfit: 0,
          gamesPlayed: 0,
          avgBuyIn: 0,
          avgProfit: 0,
          winRate: 0,
        },
        earningsOverTime: [],
        recentGames: [],
      };
    }

    // Get all games from user's groups
    const gamesInGroups = await Promise.all(
      args.groupIds.map((gId) =>
        ctx.db
          .query("games")
          .withIndex("by_groupId", (q) => q.eq("groupId", gId))
          .collect()
      )
    );
    const games = gamesInGroups.flat();
    const gameMap = new Map(games.map((g) => [g._id, g]));

    // Get game players
    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();

    const filteredGamePlayers = gamePlayers.filter(
      (gp) => gameMap.get(gp.gameId)?.status === "COMPLETED"
    );

    const gamesPlayed = filteredGamePlayers.length;
    const totalBuyIns = filteredGamePlayers.reduce(
      (sum, gp) => sum + gp.buyIn,
      0
    );
    const totalCashOuts = filteredGamePlayers.reduce(
      (sum, gp) => sum + (gp.cashOut ?? 0),
      0
    );
    const netProfit = totalCashOuts - totalBuyIns;
    const avgBuyIn = gamesPlayed > 0 ? totalBuyIns / gamesPlayed : 0;
    const avgProfit = gamesPlayed > 0 ? netProfit / gamesPlayed : 0;
    const wins = filteredGamePlayers.filter(
      (gp) => (gp.profit ?? 0) > 0
    ).length;
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;

    const earningsOverTime = [...filteredGamePlayers]
      .sort((a, b) => {
        const gameA = gameMap.get(a.gameId);
        const gameB = gameMap.get(b.gameId);
        return (gameA?.date ?? 0) - (gameB?.date ?? 0);
      })
      .map((gp) => ({
        gameId: gp.gameId,
        date: gameMap.get(gp.gameId)?.date ?? 0,
        profit: gp.profit ?? (gp.cashOut ?? 0) - gp.buyIn,
      }));

    // Recent games with profit
    const recentGamePlayers = [...filteredGamePlayers]
      .sort((a, b) => {
        const gameA = gameMap.get(a.gameId);
        const gameB = gameMap.get(b.gameId);
        return (gameB?.date ?? 0) - (gameA?.date ?? 0);
      })
      .slice(0, 10);

    const recentGames = await Promise.all(
      recentGamePlayers.map(async (gp) => {
        const game = gameMap.get(gp.gameId);
        const group = game ? await ctx.db.get(game.groupId) : null;
        return {
          gameId: gp.gameId,
          date: game?.date ?? 0,
          group: group ? { id: group._id, name: group.name } : null,
          buyIn: gp.buyIn,
          cashOut: gp.cashOut ?? 0,
          profit: gp.profit ?? 0,
        };
      })
    );

    return {
      overview: {
        totalBuyIns,
        totalCashOuts,
        netProfit,
        gamesPlayed,
        avgBuyIn,
        avgProfit,
        winRate,
      },
      earningsOverTime,
      recentGames,
    };
  },
});

// Get a specific player's stats by user ID (for viewing other players)
export const getPlayerStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Find user by ID first (existing behavior), then fallback to player ID
    const users = await ctx.db.query("users").collect();
    let user: Doc<"users"> | null =
      users.find((u) => u._id === args.userId) ?? null;
    let player: Doc<"players"> | null = null;

    if (user) {
      const userId = user._id;
      player = await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    } else {
      const players = await ctx.db.query("players").collect();
      player = players.find((p) => p._id === args.userId) ?? null;
      if (player?.userId) {
        user = await ctx.db.get(player.userId);
      }
    }

    if (!player) {
      return null;
    }

    // Check if profile is private
    if (user?.profilePrivate) {
      return {
        playerName: player.name,
        isPrivate: true,
        venmo: null,
        zelle: null,
        totalBuyIns: 0,
        totalCashOuts: 0,
        netProfit: 0,
        gamesPlayed: 0,
        earningsOverTime: [],
        recentGames: [],
      };
    }

    // Get game players
    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();

    // Scope to groups the user belongs to when possible; otherwise include all games for this player
    let gameMap = new Map<Id<"games">, Doc<"games">>();
    let filteredGamePlayers = gamePlayers;
    if (user) {
      const memberships = await ctx.db
        .query("groupMembers")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      const groupIds = memberships.map((m) => m.groupId);

      if (groupIds.length > 0) {
        const gamesInGroups = await Promise.all(
          groupIds.map((gId) =>
            ctx.db
              .query("games")
              .withIndex("by_groupId", (q) => q.eq("groupId", gId))
              .collect()
          )
        );
        const games = gamesInGroups.flat();
        gameMap = new Map(games.map((g) => [g._id, g]));
        filteredGamePlayers = gamePlayers.filter((gp) =>
          gameMap.has(gp.gameId)
        );
      }
    }
    if (gameMap.size === 0) {
      const games = await Promise.all(
        filteredGamePlayers.map((gp) => ctx.db.get(gp.gameId))
      );
      gameMap = new Map(
        games
          .filter((game): game is Doc<"games"> => game !== null)
          .map((game) => [game._id, game])
      );
    }

    filteredGamePlayers = filteredGamePlayers.filter(
      (gp) => gameMap.get(gp.gameId)?.status === "COMPLETED"
    );

    const gamesPlayed = filteredGamePlayers.length;
    const totalBuyIns = filteredGamePlayers.reduce(
      (sum, gp) => sum + gp.buyIn,
      0
    );
    const totalCashOuts = filteredGamePlayers.reduce(
      (sum, gp) => sum + (gp.cashOut ?? 0),
      0
    );
    const netProfit = totalCashOuts - totalBuyIns;

    const earningsOverTime = [...filteredGamePlayers]
      .sort((a, b) => {
        const gameA = gameMap.get(a.gameId);
        const gameB = gameMap.get(b.gameId);
        return (gameA?.date ?? 0) - (gameB?.date ?? 0);
      })
      .map((gp) => ({
        gameId: gp.gameId as string,
        date: gameMap.get(gp.gameId)?.date ?? 0,
        profit: gp.profit ?? (gp.cashOut ?? 0) - gp.buyIn,
      }));

    // Recent games
    const recentGamePlayers = [...filteredGamePlayers]
      .sort((a, b) => {
        const gameA = gameMap.get(a.gameId);
        const gameB = gameMap.get(b.gameId);
        return (gameB?.date ?? 0) - (gameA?.date ?? 0);
      })
      .slice(0, 10);

    const recentGames = await Promise.all(
      recentGamePlayers.map(async (gp) => {
        const game = gameMap.get(gp.gameId);
        const group = game ? await ctx.db.get(game.groupId) : null;
        return {
          gameId: gp.gameId as string,
          date: game?.date ?? 0,
          groupName: group?.name ?? "Unknown",
          buyIn: gp.buyIn,
          cashOut: gp.cashOut ?? null,
          profit: gp.profit ?? null,
        };
      })
    );

    return {
      playerName: player.name,
      isPrivate: false,
      venmo: user?.venmo ?? null,
      zelle: user?.zelle ?? null,
      totalBuyIns,
      totalCashOuts,
      netProfit,
      gamesPlayed,
      earningsOverTime,
      recentGames,
    };
  },
});
