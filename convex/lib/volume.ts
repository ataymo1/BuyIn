import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export interface GroupVolume {
  totalBuyIns: number;
  completedSessionCount: number;
  lastCompletedSessionAt: number | null;
}

export async function getGroupVolume(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"groups">
): Promise<GroupVolume> {
  const games = await ctx.db
    .query("games")
    .withIndex("by_groupId_status", (q) =>
      q.eq("groupId", groupId).eq("status", "COMPLETED")
    )
    .collect();

  const sessionTotals = await Promise.all(
    games.map(async (game) => {
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
        .collect();

      return transactions.reduce((cents, transaction) => {
        if (
          transaction.type !== "buyin" ||
          (transaction.status !== "APPROVED" &&
            transaction.status !== undefined)
        ) {
          return cents;
        }
        return cents + Math.round(transaction.amount * 100);
      }, 0);
    })
  );

  return {
    totalBuyIns: sessionTotals.reduce((sum, cents) => sum + cents, 0) / 100,
    completedSessionCount: games.length,
    lastCompletedSessionAt: games.reduce<number | null>(
      (latest, game) =>
        latest === null ? game.date : Math.max(latest, game.date),
      null
    ),
  };
}

export async function getCommunityVolume(ctx: Pick<QueryCtx, "db">) {
  // Discovery currently includes every group. Do not inherit the listing's
  // 50-group limit or the search's 20-result limit for the community total.
  const groups = await ctx.db.query("groups").collect();
  const volumes = await Promise.all(
    groups.map((group) => getGroupVolume(ctx, group._id))
  );

  return {
    totalBuyIns:
      volumes.reduce(
        (cents, volume) => cents + Math.round(volume.totalBuyIns * 100),
        0
      ) / 100,
    completedSessionCount: volumes.reduce(
      (count, volume) => count + volume.completedSessionCount,
      0
    ),
    groupCount: groups.length,
  };
}
