import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { ensureCurrentSeason, getOrCreateFirstSeason } from "./seasons";

const BATCH_SIZE = 25;
const cursor = v.union(v.string(), v.null());

// Run after deploying the optional season fields:
// pnpm exec convex run migrations:startSeasonBackfill '{}'
export const startSeasonBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillGroups, {
      cursor: null,
    });
  },
});

export const backfillGroups = internalMutation({
  args: { cursor },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("groups").paginate({
      cursor: args.cursor,
      numItems: BATCH_SIZE,
    });

    for (const group of result.page) {
      await ensureCurrentSeason(ctx, group);
    }

    if (result.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillGames, {
        cursor: null,
      });
      return;
    }

    await ctx.scheduler.runAfter(0, internal.migrations.backfillGroups, {
      cursor: result.continueCursor,
    });
  },
});

export const backfillGames = internalMutation({
  args: { cursor },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("games").paginate({
      cursor: args.cursor,
      numItems: BATCH_SIZE,
    });

    for (const game of result.page) {
      if (game.seasonId) {
        continue;
      }
      const group = await ctx.db.get(game.groupId);
      if (!group) {
        continue;
      }
      await ensureCurrentSeason(ctx, group);
      const firstSeason = await getOrCreateFirstSeason(ctx, group);
      await ctx.db.patch(game._id, { seasonId: firstSeason._id });
    }

    if (result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillImportRequests,
        { cursor: null }
      );
      return;
    }

    await ctx.scheduler.runAfter(0, internal.migrations.backfillGames, {
      cursor: result.continueCursor,
    });
  },
});

export const backfillImportRequests = internalMutation({
  args: { cursor },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("pokerNowImportRequests").paginate({
      cursor: args.cursor,
      numItems: BATCH_SIZE,
    });

    for (const request of result.page) {
      if (request.seasonId) {
        continue;
      }
      const group = await ctx.db.get(request.groupId);
      if (!group) {
        continue;
      }
      await ensureCurrentSeason(ctx, group);
      const firstSeason = await getOrCreateFirstSeason(ctx, group);
      await ctx.db.patch(request._id, { seasonId: firstSeason._id });
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillImportRequests,
        { cursor: result.continueCursor }
      );
    }
  },
});
