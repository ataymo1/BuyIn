// biome-ignore-all lint/style/useFilenamingConvention: Convex exposes underscore filenames as stable API namespaces.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";

interface PlayerHistorySummary {
  gamesPlayed: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalProfit: number;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

async function getGroupGames(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">
) {
  return await ctx.db
    .query("games")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();
}

async function getGroupHistorySummary(
  ctx: QueryCtx | MutationCtx,
  playerId: Id<"players">,
  gameIds: Set<Id<"games">>
): Promise<PlayerHistorySummary> {
  const rows = await ctx.db
    .query("gamePlayers")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .collect();
  const groupRows = rows.filter((row) => gameIds.has(row.gameId));
  const totalBuyIn = groupRows.reduce((sum, row) => sum + row.buyIn, 0);
  const totalCashOut = groupRows.reduce(
    (sum, row) => sum + (row.cashOut ?? 0),
    0
  );
  return {
    gamesPlayed: groupRows.length,
    totalBuyIn: roundCurrency(totalBuyIn),
    totalCashOut: roundCurrency(totalCashOut),
    totalProfit: roundCurrency(totalCashOut - totalBuyIn),
  };
}

async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_userId", (q) =>
      q.eq("groupId", groupId).eq("userId", userId)
    )
    .first();
}

export const getClaimablePlayers = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    if (!(await requireMembership(ctx, args.groupId, args.userId))) {
      return [];
    }

    const games = await getGroupGames(ctx, args.groupId);
    const rows = (
      await Promise.all(
        games.map((game) =>
          ctx.db
            .query("gamePlayers")
            .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
            .collect()
        )
      )
    ).flat();
    const pendingClaims = await ctx.db
      .query("playerClaimRequests")
      .withIndex("by_groupId_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "PENDING")
      )
      .collect();
    const pendingPlayerIds = new Set(
      pendingClaims.map((claim) => claim.sourcePlayerId)
    );
    const aliases = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const rowsByPlayer = new Map<Id<"players">, typeof rows>();
    for (const row of rows) {
      const playerRows = rowsByPlayer.get(row.playerId) ?? [];
      playerRows.push(row);
      rowsByPlayer.set(row.playerId, playerRows);
    }

    const candidates = await Promise.all(
      [...rowsByPlayer].map(async ([playerId, playerRows]) => {
        const player = await ctx.db.get(playerId);
        if (!player || player.userId || pendingPlayerIds.has(playerId)) {
          return null;
        }
        const totalBuyIn = playerRows.reduce((sum, row) => sum + row.buyIn, 0);
        const totalCashOut = playerRows.reduce(
          (sum, row) => sum + (row.cashOut ?? 0),
          0
        );
        return {
          playerId,
          name: player.name,
          gamesPlayed: playerRows.length,
          totalBuyIn: roundCurrency(totalBuyIn),
          totalCashOut: roundCurrency(totalCashOut),
          totalProfit: roundCurrency(totalCashOut - totalBuyIn),
          aliases: [
            ...new Set(
              aliases
                .filter((alias) => alias.playerId === playerId)
                .map((alias) => alias.displayName)
            ),
          ],
        };
      })
    );

    return candidates
      .filter((candidate) => candidate !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const submitClaim = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    sourcePlayerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    if (!(await requireMembership(ctx, args.groupId, args.userId))) {
      throw new Error("Only group members can claim player history");
    }
    const source = await ctx.db.get(args.sourcePlayerId);
    if (!source || source.userId) {
      throw new Error("This player history is no longer available");
    }

    const games = await getGroupGames(ctx, args.groupId);
    const gameIds = new Set(games.map((game) => game._id));
    const summary = await getGroupHistorySummary(
      ctx,
      args.sourcePlayerId,
      gameIds
    );
    if (summary.gamesPlayed === 0) {
      throw new Error("This player has no history in the group");
    }

    const existingClaims = await ctx.db
      .query("playerClaimRequests")
      .withIndex("by_groupId_sourcePlayerId", (q) =>
        q.eq("groupId", args.groupId).eq("sourcePlayerId", args.sourcePlayerId)
      )
      .collect();
    if (existingClaims.some((claim) => claim.status === "PENDING")) {
      throw new Error("This player history already has a pending claim");
    }

    let target = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!target) {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("User not found");
      }
      const targetPlayerId = await ctx.db.insert("players", {
        name: user.name?.trim() || user.email,
        email: user.email,
        userId: args.userId,
      });
      target = await ctx.db.get(targetPlayerId);
    }
    if (!target) {
      throw new Error("Could not create a player profile");
    }

    return await ctx.db.insert("playerClaimRequests", {
      groupId: args.groupId,
      sourcePlayerId: args.sourcePlayerId,
      claimantUserId: args.userId,
      targetPlayerId: target._id,
      status: "PENDING",
      requestedAt: Date.now(),
    });
  },
});

export const getPendingClaims = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (group?.ownerId !== args.userId) {
      return [];
    }
    const games = await getGroupGames(ctx, args.groupId);
    const gameIds = new Set(games.map((game) => game._id));
    const claims = await ctx.db
      .query("playerClaimRequests")
      .withIndex("by_groupId_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "PENDING")
      )
      .collect();

    return await Promise.all(
      claims.map(async (claim) => {
        const [source, claimant, target, summary] = await Promise.all([
          ctx.db.get(claim.sourcePlayerId),
          ctx.db.get(claim.claimantUserId),
          ctx.db.get(claim.targetPlayerId),
          getGroupHistorySummary(ctx, claim.sourcePlayerId, gameIds),
        ]);
        return {
          ...claim,
          sourceName: source?.name ?? "Unknown player",
          claimantName:
            claimant?.name ?? claimant?.email ?? target?.name ?? "Group member",
          ...summary,
        };
      })
    );
  },
});

async function mergePlayerHistory(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  sourcePlayerId: Id<"players">,
  targetPlayerId: Id<"players">
) {
  const games = await getGroupGames(ctx, groupId);
  const gameIds = new Set(games.map((game) => game._id));

  for (const game of games) {
    const rows = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
      .collect();
    const sourceRows = rows.filter((row) => row.playerId === sourcePlayerId);
    if (sourceRows.length === 0) {
      continue;
    }
    const targetRows = rows.filter((row) => row.playerId === targetPlayerId);
    const mergedRows = [...targetRows, ...sourceRows];
    const buyIn = roundCurrency(
      mergedRows.reduce((sum, row) => sum + row.buyIn, 0)
    );
    const cashOut = roundCurrency(
      mergedRows.reduce((sum, row) => sum + (row.cashOut ?? 0), 0)
    );
    const retained = targetRows[0] ?? sourceRows[0];
    await ctx.db.patch(retained._id, {
      playerId: targetPlayerId,
      buyIn,
      cashOut,
      profit: roundCurrency(cashOut - buyIn),
    });
    for (const row of mergedRows) {
      if (row._id !== retained._id) {
        await ctx.db.delete(row._id);
      }
    }
  }

  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_playerId", (q) => q.eq("playerId", sourcePlayerId))
    .collect();
  for (const transaction of transactions) {
    if (gameIds.has(transaction.gameId)) {
      await ctx.db.patch(transaction._id, { playerId: targetPlayerId });
    }
  }

  const aliases = await ctx.db
    .query("pokerNowAliases")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();
  for (const alias of aliases) {
    if (alias.playerId === sourcePlayerId) {
      await ctx.db.patch(alias._id, { playerId: targetPlayerId });
    }
  }

  const pendingImports = await ctx.db
    .query("pokerNowImportRequests")
    .withIndex("by_groupId_status", (q) =>
      q.eq("groupId", groupId).eq("status", "PENDING")
    )
    .collect();
  for (const request of pendingImports) {
    if (request.players.some((player) => player.playerId === sourcePlayerId)) {
      await ctx.db.patch(request._id, {
        players: request.players.map((player) =>
          player.playerId === sourcePlayerId
            ? { ...player, playerId: targetPlayerId }
            : player
        ),
      });
    }
  }
}

export const respondToClaim = mutation({
  args: {
    requestId: v.id("playerClaimRequests"),
    userId: v.id("users"),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "PENDING") {
      throw new Error("Claim request not found");
    }
    const group = await ctx.db.get(request.groupId);
    if (group?.ownerId !== args.userId) {
      throw new Error("Only the group leader can review claims");
    }
    if (!args.approve) {
      await ctx.db.patch(request._id, {
        status: "REJECTED",
        respondedAt: Date.now(),
        respondedById: args.userId,
      });
      return;
    }

    const membership = await requireMembership(
      ctx,
      request.groupId,
      request.claimantUserId
    );
    const source = await ctx.db.get(request.sourcePlayerId);
    const target = await ctx.db.get(request.targetPlayerId);
    if (!membership) {
      throw new Error("The claimant is no longer a group member");
    }
    if (!source || source.userId) {
      throw new Error("This player history is no longer available");
    }
    if (!target || target.userId !== request.claimantUserId) {
      throw new Error("The claimant's player profile has changed");
    }

    await mergePlayerHistory(
      ctx,
      request.groupId,
      request.sourcePlayerId,
      request.targetPlayerId
    );
    await ctx.db.patch(request._id, {
      status: "APPROVED",
      respondedAt: Date.now(),
      respondedById: args.userId,
    });
  },
});
