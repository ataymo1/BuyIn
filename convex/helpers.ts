import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = QueryCtx | MutationCtx;

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getGroupGames(ctx: DbCtx, groupId: Id<"groups">) {
  return await ctx.db
    .query("games")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .collect();
}

export async function getUserDisplaySummary(ctx: DbCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) {
    return null;
  }

  const player = await ctx.db
    .query("players")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();

  return {
    id: user._id,
    name: player?.name ?? user.name ?? user.email ?? "Unknown",
    email: user.email,
    image: user.image,
  };
}

export async function getPlayerDisplaySummary(
  ctx: DbCtx,
  playerId: Id<"players">
) {
  const player = await ctx.db.get(playerId);
  if (!player) {
    return null;
  }

  return {
    id: player._id,
    name: player.name,
    userId: player.userId ?? null,
  };
}

export async function canUserManageGame(
  ctx: DbCtx,
  game: Doc<"games">,
  userId: Id<"users">
) {
  if (game.createdById === userId) {
    return true;
  }

  const group = await ctx.db.get(game.groupId);
  return group?.ownerId === userId;
}

export async function requireGameManager(
  ctx: DbCtx,
  game: Doc<"games">,
  userId: Id<"users">,
  message: string
) {
  if (game.createdById === userId) {
    return;
  }

  const group = await ctx.db.get(game.groupId);
  if (!group) {
    throw new Error("Group not found");
  }

  if (group.ownerId !== userId) {
    throw new Error(message);
  }
}

/**
 * Repoints every trace of `sourcePlayerId` onto `targetPlayerId` within one group.
 * Rows that collide in the same game are summed into a single retained row, which
 * is what makes this safe for a player who appears twice in one session.
 * Scoped to `groupId`: history the source has in other groups is left untouched,
 * so the source `players` doc is deliberately not deleted.
 */
export async function mergePlayerHistory(
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

export async function deleteGameCascade(ctx: MutationCtx, gameId: Id<"games">) {
  const pokerNowPlayers = await ctx.db
    .query("pokerNowSessionPlayers")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .collect();

  for (const pokerNowPlayer of pokerNowPlayers) {
    await ctx.db.delete(pokerNowPlayer._id);
  }

  const gamePlayers = await ctx.db
    .query("gamePlayers")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .collect();

  for (const gamePlayer of gamePlayers) {
    await ctx.db.delete(gamePlayer._id);
  }

  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .collect();

  for (const transaction of transactions) {
    await ctx.db.delete(transaction._id);
  }

  await ctx.db.delete(gameId);
}
