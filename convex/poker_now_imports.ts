// biome-ignore-all lint/style/useFilenamingConvention: Convex exposes underscore filenames as stable API namespaces.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getCandidates = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    const memberPlayers = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        const player = await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", member.userId))
          .first();
        return player
          ? {
              id: player._id,
              name: player.name,
              email: user?.email,
              isMember: true,
            }
          : null;
      })
    );
    const aliases = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    return {
      players: memberPlayers.filter((player) => player !== null),
      aliases,
    };
  },
});

const importedPlayer = v.object({
  sourcePlayerId: v.string(),
  displayName: v.string(),
  buyIn: v.number(),
  cashOut: v.number(),
  playerId: v.optional(v.id("players")),
});

export const createSession = mutation({
  args: {
    groupId: v.id("groups"),
    createdById: v.id("users"),
    sourceId: v.string(),
    date: v.number(),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    handCount: v.number(),
    players: v.array(importedPlayer),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.createdById)
      )
      .first();
    if (!membership) {
      throw new Error("Only group members can import sessions");
    }
    const duplicate = await ctx.db
      .query("games")
      .withIndex("by_groupId_importSourceId", (q) =>
        q.eq("groupId", args.groupId).eq("importSourceId", args.sourceId)
      )
      .first();
    if (duplicate) {
      throw new Error(
        "This PokerNow log has already been imported into this group"
      );
    }
    if (args.players.length < 2) {
      throw new Error("An imported session needs at least two players");
    }

    const gameId = await ctx.db.insert("games", {
      date: args.date,
      location: "PokerNow",
      notes: `Imported from PokerNow · ${args.handCount} hands${
        args.smallBlind && args.bigBlind
          ? ` · ${args.smallBlind}/${args.bigBlind} blinds`
          : ""
      }`,
      status: "COMPLETED",
      gameType: "cash",
      groupId: args.groupId,
      createdById: args.createdById,
      importSource: "POKER_NOW",
      importSourceId: args.sourceId,
    });

    for (const imported of args.players) {
      if (
        !(Number.isFinite(imported.buyIn) && Number.isFinite(imported.cashOut))
      ) {
        throw new Error("Player totals must be valid numbers");
      }
      let playerId = imported.playerId;
      if (playerId && !(await ctx.db.get(playerId))) {
        throw new Error("A selected player no longer exists");
      }
      playerId ??= await ctx.db.insert("players", {
        name: imported.displayName.trim(),
      });

      const priorAlias = await ctx.db
        .query("pokerNowAliases")
        .withIndex("by_groupId_sourcePlayerId", (q) =>
          q
            .eq("groupId", args.groupId)
            .eq("sourcePlayerId", imported.sourcePlayerId)
        )
        .first();
      if (priorAlias) {
        await ctx.db.patch(priorAlias._id, {
          playerId,
          displayName: imported.displayName.trim(),
        });
      } else {
        await ctx.db.insert("pokerNowAliases", {
          groupId: args.groupId,
          sourcePlayerId: imported.sourcePlayerId,
          displayName: imported.displayName.trim(),
          playerId,
        });
      }
      await ctx.db.insert("gamePlayers", {
        gameId,
        playerId,
        buyIn: imported.buyIn,
        cashOut: imported.cashOut,
        profit: Math.round((imported.cashOut - imported.buyIn) * 100) / 100,
      });
      await ctx.db.insert("transactions", {
        gameId,
        playerId,
        type: "buyin",
        amount: imported.buyIn,
        description: "Imported from PokerNow",
        createdById: args.createdById,
        status: "APPROVED",
      });
      await ctx.db.insert("transactions", {
        gameId,
        playerId,
        type: "cashout",
        amount: imported.cashOut,
        description: "Imported from PokerNow",
        createdById: args.createdById,
        status: "APPROVED",
      });
    }
    return gameId;
  },
});
