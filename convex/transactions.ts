import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get transactions for a game
export const getTransactions = query({
  args: {
    gameId: v.optional(v.id("games")),
    groupIds: v.optional(v.array(v.id("groups"))),
  },
  handler: async (ctx, args) => {
    let transactions;

    if (args.gameId) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId!))
        .collect();
    } else if (args.groupIds && args.groupIds.length > 0) {
      // Get games from groups first
      const gamesInGroups = await Promise.all(
        args.groupIds.map((gId) =>
          ctx.db
            .query("games")
            .withIndex("by_groupId", (q) => q.eq("groupId", gId))
            .collect()
        )
      );
      const gameIds = gamesInGroups.flat().map((g) => g._id);

      const allTransactions = await Promise.all(
        gameIds.map((gameId) =>
          ctx.db
            .query("transactions")
            .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
            .collect()
        )
      );
      transactions = allTransactions.flat();
    } else {
      transactions = await ctx.db.query("transactions").collect();
    }

    // Sort by creation time
    transactions.sort((a, b) => b._creationTime - a._creationTime);

    // Add details
    const transactionsWithDetails = await Promise.all(
      transactions.map(async (tx) => {
        const player = await ctx.db.get(tx.playerId);
        const game = await ctx.db.get(tx.gameId);
        const createdBy = await ctx.db.get(tx.createdById);

        let group = null;
        if (game) {
          group = await ctx.db.get(game.groupId);
        }

        return {
          ...tx,
          id: tx._id,
          player: player ? { id: player._id, name: player.name } : null,
          game: game
            ? {
                ...game,
                id: game._id,
                group: group ? { id: group._id, name: group.name } : null,
              }
            : null,
          createdBy: createdBy
            ? {
                id: createdBy._id,
                name: createdBy.name,
                email: createdBy.email,
              }
            : null,
        };
      })
    );

    return transactionsWithDetails;
  },
});

// Create transaction (with auto-join and totals update)
export const createTransaction = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    type: v.string(),
    amount: v.number(),
    description: v.optional(v.string()),
    createdById: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Auto-join if not already in game
    let gamePlayer = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();

    if (!gamePlayer) {
      const gpId = await ctx.db.insert("gamePlayers", {
        gameId: args.gameId,
        playerId: args.playerId,
        buyIn: 0,
      });
      gamePlayer = await ctx.db.get(gpId);
    }

    // Create transaction
    const txId = await ctx.db.insert("transactions", {
      gameId: args.gameId,
      playerId: args.playerId,
      type: args.type,
      amount: args.amount,
      description: args.description,
      createdById: args.createdById,
    });

    // Update game player totals
    if (gamePlayer) {
      if (args.type === "buyin") {
        await ctx.db.patch(gamePlayer._id, {
          buyIn: gamePlayer.buyIn + args.amount,
        });
      } else if (args.type === "cashout") {
        // Sum all cashout transactions for this player in this game
        const allCashOutTxs = await ctx.db
          .query("transactions")
          .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
          .filter((q) =>
            q.and(
              q.eq(q.field("playerId"), args.playerId),
              q.eq(q.field("type"), "cashout")
            )
          )
          .collect();
        // Include the new transaction amount (it's already inserted)
        const totalCashOut = allCashOutTxs.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );
        const profit = totalCashOut - gamePlayer.buyIn;
        await ctx.db.patch(gamePlayer._id, {
          cashOut: totalCashOut,
          profit,
        });
      }
    }

    return txId;
  },
});

// Delete transaction
export const deleteTransaction = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) {
      return;
    }

    // Update game player totals
    const gamePlayer = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", tx.gameId).eq("playerId", tx.playerId)
      )
      .first();

    if (gamePlayer) {
      if (tx.type === "buyin") {
        await ctx.db.patch(gamePlayer._id, {
          buyIn: Math.max(0, gamePlayer.buyIn - tx.amount),
        });
      } else if (tx.type === "cashout") {
        // Recalculate total cashout from remaining transactions (excluding the one being deleted)
        const remainingCashOutTxs = await ctx.db
          .query("transactions")
          .withIndex("by_gameId", (q) => q.eq("gameId", tx.gameId))
          .filter((q) =>
            q.and(
              q.eq(q.field("playerId"), tx.playerId),
              q.eq(q.field("type"), "cashout"),
              q.neq(q.field("_id"), args.transactionId)
            )
          )
          .collect();
        const totalCashOut = remainingCashOutTxs.reduce(
          (sum, t) => sum + t.amount,
          0
        );
        if (totalCashOut > 0) {
          await ctx.db.patch(gamePlayer._id, {
            cashOut: totalCashOut,
            profit: totalCashOut - gamePlayer.buyIn,
          });
        } else {
          await ctx.db.patch(gamePlayer._id, {
            cashOut: undefined,
            profit: undefined,
          });
        }
      }
    }

    await ctx.db.delete(args.transactionId);
  },
});

// Update transaction
export const updateTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { transactionId, ...updates } = args;
    const tx = await ctx.db.get(transactionId);
    if (!tx) {
      return null;
    }

    // If amount changed, update game player totals
    if (args.amount !== undefined && args.amount !== tx.amount) {
      const gamePlayer = await ctx.db
        .query("gamePlayers")
        .withIndex("by_gameId_playerId", (q) =>
          q.eq("gameId", tx.gameId).eq("playerId", tx.playerId)
        )
        .first();

      if (gamePlayer) {
        const amountDiff = args.amount - tx.amount;
        if (tx.type === "buyin") {
          await ctx.db.patch(gamePlayer._id, {
            buyIn: gamePlayer.buyIn + amountDiff,
          });
        } else if (tx.type === "cashout") {
          // Recalculate total cashout with the updated amount
          const allCashOutTxs = await ctx.db
            .query("transactions")
            .withIndex("by_gameId", (q) => q.eq("gameId", tx.gameId))
            .filter((q) =>
              q.and(
                q.eq(q.field("playerId"), tx.playerId),
                q.eq(q.field("type"), "cashout")
              )
            )
            .collect();
          // Sum all cashouts, but use the new amount for the current transaction
          const totalCashOut = allCashOutTxs.reduce((sum, t) => {
            if (t._id === args.transactionId) {
              return sum + args.amount!;
            }
            return sum + t.amount;
          }, 0);
          await ctx.db.patch(gamePlayer._id, {
            cashOut: totalCashOut,
            profit: totalCashOut - gamePlayer.buyIn,
          });
        }
      }
    }

    await ctx.db.patch(transactionId, updates);
    return await ctx.db.get(transactionId);
  },
});
