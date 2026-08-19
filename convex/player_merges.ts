// biome-ignore-all lint/style/useFilenamingConvention: Convex exposes underscore filenames as stable API namespaces.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getGroupGames, mergePlayerHistory, roundCurrency } from "./helpers";

const MAX_PLAYER_NAME_LENGTH = 80;

type DbCtx = QueryCtx | MutationCtx;

async function getGroupRows(
  ctx: DbCtx,
  playerId: Id<"players">,
  gameById: Map<Id<"games">, Doc<"games">>
) {
  const rows = await ctx.db
    .query("gamePlayers")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .collect();
  return rows.filter((row) => gameById.has(row.gameId));
}

/**
 * Group-scoped session breakdown for one player, newest first. Feeds the
 * confirmation step so the leader can see exactly which sessions move.
 */
async function buildPlayerPreview(
  ctx: DbCtx,
  playerId: Id<"players">,
  gameById: Map<Id<"games">, Doc<"games">>
) {
  const player = await ctx.db.get(playerId);
  const rows = await getGroupRows(ctx, playerId, gameById);

  const sessions = rows
    .map((row) => {
      const game = gameById.get(row.gameId);
      const cashOut = row.cashOut ?? 0;
      return {
        gameId: row.gameId,
        date: game?.date ?? 0,
        location: game?.location ?? null,
        buyIn: roundCurrency(row.buyIn),
        cashOut: roundCurrency(cashOut),
        profit: roundCurrency(cashOut - row.buyIn),
      };
    })
    .sort((a, b) => b.date - a.date);

  return {
    playerId,
    name: player?.name ?? "Unknown player",
    isClaimed: Boolean(player?.userId),
    sessions,
    gamesPlayed: sessions.length,
    totalBuyIn: roundCurrency(
      sessions.reduce((sum, session) => sum + session.buyIn, 0)
    ),
    totalCashOut: roundCurrency(
      sessions.reduce((sum, session) => sum + session.cashOut, 0)
    ),
    totalProfit: roundCurrency(
      sessions.reduce((sum, session) => sum + session.profit, 0)
    ),
  };
}

type PlayerPreview = Awaited<ReturnType<typeof buildPlayerPreview>>;

/**
 * Sessions where more than one selected player appears. Merging sums those rows
 * into a single entry, so the leader is warned about them explicitly.
 */
function findSharedSessions(players: PlayerPreview[]) {
  const namesByGame = new Map<
    Id<"games">,
    { date: number; location: string | null; names: string[] }
  >();

  for (const player of players) {
    for (const session of player.sessions) {
      const entry = namesByGame.get(session.gameId) ?? {
        date: session.date,
        location: session.location,
        names: [],
      };
      entry.names.push(player.name);
      namesByGame.set(session.gameId, entry);
    }
  }

  return [...namesByGame]
    .filter(([, entry]) => entry.names.length > 1)
    .map(([gameId, entry]) => ({ gameId, ...entry }))
    .sort((a, b) => b.date - a.date);
}

export const getMergePreview = query({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    playerIds: v.array(v.id("players")),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (group?.ownerId !== args.userId || args.playerIds.length === 0) {
      return null;
    }

    const games = await getGroupGames(ctx, args.groupId);
    const gameById = new Map(games.map((game) => [game._id, game]));
    const uniqueIds = [...new Set(args.playerIds)];

    const players = await Promise.all(
      uniqueIds.map((playerId) => buildPlayerPreview(ctx, playerId, gameById))
    );

    const distinctGames = new Set(
      players.flatMap((player) =>
        player.sessions.map((session) => session.gameId)
      )
    );

    return {
      players,
      sharedSessions: findSharedSessions(players),
      combined: {
        gamesPlayed: distinctGames.size,
        totalBuyIn: roundCurrency(
          players.reduce((sum, player) => sum + player.totalBuyIn, 0)
        ),
        totalCashOut: roundCurrency(
          players.reduce((sum, player) => sum + player.totalCashOut, 0)
        ),
        totalProfit: roundCurrency(
          players.reduce((sum, player) => sum + player.totalProfit, 0)
        ),
      },
    };
  },
});

async function requireUnclaimedPlayer(ctx: DbCtx, playerId: Id<"players">) {
  const player = await ctx.db.get(playerId);
  if (!player) {
    throw new Error("One of the selected players no longer exists");
  }
  if (player.userId) {
    throw new Error(
      `${player.name} is linked to an account and cannot be combined`
    );
  }
  return player;
}

/**
 * Merging a player out from under an open claim would invalidate the claim's
 * own validation on approval, so the leader has to settle the claim first.
 */
async function assertNoPendingClaims(
  ctx: DbCtx,
  groupId: Id<"groups">,
  playerIds: Id<"players">[]
) {
  const pendingClaims = await ctx.db
    .query("playerClaimRequests")
    .withIndex("by_groupId_status", (q) =>
      q.eq("groupId", groupId).eq("status", "PENDING")
    )
    .collect();
  const claimed = new Set(pendingClaims.map((claim) => claim.sourcePlayerId));

  if (playerIds.some((playerId) => claimed.has(playerId))) {
    throw new Error(
      "A selected player has a pending claim. Review that claim before combining."
    );
  }
}

export const mergePlayers = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    targetPlayerId: v.id("players"),
    sourcePlayerIds: v.array(v.id("players")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (group?.ownerId !== args.userId) {
      throw new Error("Only the group leader can combine players");
    }

    const sourceIds = [...new Set(args.sourcePlayerIds)].filter(
      (playerId) => playerId !== args.targetPlayerId
    );
    if (sourceIds.length === 0) {
      throw new Error("Select at least two different players to combine");
    }

    const target = await requireUnclaimedPlayer(ctx, args.targetPlayerId);
    for (const sourceId of sourceIds) {
      await requireUnclaimedPlayer(ctx, sourceId);
    }
    await assertNoPendingClaims(ctx, args.groupId, [
      args.targetPlayerId,
      ...sourceIds,
    ]);

    for (const sourceId of sourceIds) {
      await mergePlayerHistory(
        ctx,
        args.groupId,
        sourceId,
        args.targetPlayerId
      );
    }

    const name = args.name?.trim();
    if (name && name !== target.name) {
      if (name.length > MAX_PLAYER_NAME_LENGTH) {
        throw new Error(
          `Player names must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer`
        );
      }
      await ctx.db.patch(args.targetPlayerId, { name });
    }

    return { playerId: args.targetPlayerId, mergedCount: sourceIds.length };
  },
});
