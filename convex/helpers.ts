import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = QueryCtx | MutationCtx;

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

export async function isUserGroupMember(
  ctx: DbCtx,
  groupId: Id<"groups">,
  userId: Id<"users">
) {
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_userId", (q) =>
      q.eq("groupId", groupId).eq("userId", userId)
    )
    .first();

  return Boolean(membership);
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

  const liveHands = await ctx.db
    .query("livePokerHands")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .collect();

  for (const liveHand of liveHands) {
    await ctx.db.delete(liveHand._id);
  }

  await ctx.db.delete(gameId);
}
