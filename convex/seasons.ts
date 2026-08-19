import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";

const BACKFILL_BATCH_SIZE = 50;

export async function getOrCreateFirstSeason(
  ctx: MutationCtx,
  group: Doc<"groups">
) {
  const firstSeasons = await ctx.db
    .query("seasons")
    .withIndex("by_groupId_number", (q) =>
      q.eq("groupId", group._id).eq("number", 1)
    )
    .collect();

  if (firstSeasons.length > 1) {
    throw new Error("This group has duplicate first seasons");
  }
  if (firstSeasons[0]) {
    return firstSeasons[0];
  }

  const existingSeasons = await ctx.db
    .query("seasons")
    .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
    .collect();
  if (existingSeasons.length > 0) {
    throw new Error("This group's season history is missing Season 1");
  }

  const seasonId = await ctx.db.insert("seasons", {
    groupId: group._id,
    number: 1,
    isCurrent: true,
    createdAt: group._creationTime,
    createdById: group.ownerId,
  });
  const season = await ctx.db.get(seasonId);
  if (!season) {
    throw new Error("Could not create the group's first season");
  }
  return season;
}

export async function ensureCurrentSeason(
  ctx: MutationCtx,
  group: Doc<"groups">
) {
  const currentSeasons = await ctx.db
    .query("seasons")
    .withIndex("by_groupId_isCurrent", (q) =>
      q.eq("groupId", group._id).eq("isCurrent", true)
    )
    .collect();

  if (currentSeasons.length > 1) {
    throw new Error("This group has more than one current season");
  }
  if (currentSeasons[0]) {
    return currentSeasons[0];
  }

  const seasons = await ctx.db
    .query("seasons")
    .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
    .collect();
  if (seasons.length > 0) {
    throw new Error("This group does not have a current season");
  }

  return await getOrCreateFirstSeason(ctx, group);
}

export const ensureGroupSeason = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    if (!membership) {
      throw new Error("Only group members can view this group's seasons");
    }

    await ensureCurrentSeason(ctx, group);
    const firstSeason = await getOrCreateFirstSeason(ctx, group);

    const games = await ctx.db
      .query("games")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const legacyGames = games.filter((game) => !game.seasonId);
    for (const game of legacyGames.slice(0, BACKFILL_BATCH_SIZE)) {
      await ctx.db.patch(game._id, { seasonId: firstSeason._id });
    }

    const importRequests = await ctx.db
      .query("pokerNowImportRequests")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const legacyRequests = importRequests.filter(
      (request) => !request.seasonId
    );
    for (const request of legacyRequests.slice(0, BACKFILL_BATCH_SIZE)) {
      await ctx.db.patch(request._id, { seasonId: firstSeason._id });
    }

    return {
      hasMore:
        legacyGames.length > BACKFILL_BATCH_SIZE ||
        legacyRequests.length > BACKFILL_BATCH_SIZE,
    };
  },
});

export const getGroupSeasons = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    if (seasons.length === 0) {
      return [];
    }

    const firstSeason = seasons.find((season) => season.number === 1);
    const games = await ctx.db
      .query("games")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const ranges = new Map<
      Id<"seasons">,
      { startDate: number; endDate: number; sessionCount: number }
    >();

    for (const game of games) {
      const seasonId = game.seasonId ?? firstSeason?._id;
      if (!seasonId) {
        continue;
      }
      const range = ranges.get(seasonId);
      if (range) {
        range.startDate = Math.min(range.startDate, game.date);
        range.endDate = Math.max(range.endDate, game.date);
        range.sessionCount += 1;
      } else {
        ranges.set(seasonId, {
          startDate: game.date,
          endDate: game.date,
          sessionCount: 1,
        });
      }
    }

    return seasons
      .map((season) => {
        const range = ranges.get(season._id);
        return {
          _id: season._id,
          number: season.number,
          label: `Season ${season.number}`,
          isCurrent: season.isCurrent,
          startDate: range?.startDate ?? null,
          endDate: range?.endDate ?? null,
          sessionCount: range?.sessionCount ?? 0,
        };
      })
      .sort((left, right) => right.number - left.number);
  },
});

export const startNewSeason = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    expectedCurrentSeasonId: v.id("seasons"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || group.ownerId !== args.userId) {
      throw new Error("Only the group owner can start a new season");
    }

    const currentSeason = await ensureCurrentSeason(ctx, group);
    if (currentSeason._id !== args.expectedCurrentSeasonId) {
      throw new Error("A new season has already been started");
    }

    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const latestNumber = Math.max(...seasons.map((season) => season.number));
    if (currentSeason.number !== latestNumber) {
      throw new Error("The current season is not the latest season");
    }

    await ctx.db.patch(currentSeason._id, { isCurrent: false });
    const number = latestNumber + 1;
    const seasonId = await ctx.db.insert("seasons", {
      groupId: args.groupId,
      number,
      isCurrent: true,
      createdAt: Date.now(),
      createdById: args.userId,
    });

    return { seasonId, number };
  },
});
