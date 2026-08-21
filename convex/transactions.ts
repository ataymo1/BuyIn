import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { getPlayerDisplaySummary, getUserDisplaySummary } from "./helpers";

const transactionTypeValidator = v.union(
  v.literal("buyin"),
  v.literal("cashout")
);

// Helper to recalculate game player totals from approved transactions
async function recalculatePlayerTotals(
  ctx: MutationCtx,
  gameId: Id<"games">,
  playerId: Id<"players">
) {
  const gamePlayer = await ctx.db
    .query("gamePlayers")
    .withIndex("by_gameId_playerId", (q) =>
      q.eq("gameId", gameId).eq("playerId", playerId)
    )
    .first();

  if (!gamePlayer) {
    return;
  }

  // Get all approved transactions for this player in this game
  const allTxs = await ctx.db
    .query("transactions")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .filter((q) =>
      q.and(
        q.eq(q.field("playerId"), playerId),
        q.or(
          q.eq(q.field("status"), "APPROVED"),
          q.eq(q.field("status"), undefined) // Legacy transactions without status
        )
      )
    )
    .collect();

  const totalBuyIn = allTxs
    .filter((tx) => tx.type === "buyin")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalCashOut = allTxs
    .filter((tx) => tx.type === "cashout")
    .reduce((sum, tx) => sum + tx.amount, 0);

  await ctx.db.patch(gamePlayer._id, {
    buyIn: totalBuyIn,
    cashOut: totalCashOut,
    profit: totalCashOut - totalBuyIn,
  });
}

// Get transactions for a game
export const getTransactions = query({
  args: {
    gameId: v.optional(v.id("games")),
    groupIds: v.optional(v.array(v.id("groups"))),
    includeStatus: v.optional(
      v.array(
        v.union(
          v.literal("PENDING"),
          v.literal("APPROVED"),
          v.literal("REJECTED")
        )
      )
    ),
  },
  handler: async (ctx, args) => {
    const transactions: Doc<"transactions">[] = await (async () => {
      if (args.gameId) {
        const { gameId } = args;
        return await ctx.db
          .query("transactions")
          .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
          .collect();
      }

      if (args.groupIds && args.groupIds.length > 0) {
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
        return allTransactions.flat();
      }

      return await ctx.db.query("transactions").collect();
    })();

    let filteredTransactions = transactions;

    if (args.includeStatus && args.includeStatus.length > 0) {
      filteredTransactions = transactions.filter((tx) => {
        const status = tx.status ?? "APPROVED"; // Legacy transactions are considered approved
        return args.includeStatus?.includes(
          status as "PENDING" | "APPROVED" | "REJECTED"
        );
      });
    }

    // Sort by creation time
    filteredTransactions.sort((a, b) => b._creationTime - a._creationTime);

    // Add details
    const transactionsWithDetails = await Promise.all(
      filteredTransactions.map(async (tx) => {
        const player = await getPlayerDisplaySummary(ctx, tx.playerId);
        const game = await ctx.db.get(tx.gameId);
        const createdBy = await getUserDisplaySummary(ctx, tx.createdById);

        const group = game ? await ctx.db.get(game.groupId) : null;

        return {
          ...tx,
          id: tx._id,
          status: tx.status ?? "APPROVED", // Legacy transactions are considered approved
          player,
          game: game
            ? {
                ...game,
                id: game._id,
                group: group ? { id: group._id, name: group.name } : null,
              }
            : null,
          createdBy: createdBy
            ? {
                id: createdBy.id,
                name: createdBy.name ?? createdBy.email ?? "Unknown",
                email: createdBy.email,
              }
            : null,
        };
      })
    );

    return transactionsWithDetails;
  },
});

// Get pending transaction requests (buy-ins and cash-outs) for a session (session creator only)
export const getPendingBuyIns = query({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      return [];
    }

    // Only session creator can see pending requests
    if (game.createdById !== args.userId) {
      return [];
    }

    const pendingTxs = await ctx.db
      .query("transactions")
      .withIndex("by_gameId_status", (q) =>
        q.eq("gameId", args.gameId).eq("status", "PENDING")
      )
      .collect();

    // Add player details
    const txsWithDetails = await Promise.all(
      pendingTxs.map(async (tx) => {
        const player = await getPlayerDisplaySummary(ctx, tx.playerId);
        const createdBy = await getUserDisplaySummary(ctx, tx.createdById);
        return {
          ...tx,
          id: tx._id,
          player,
          createdBy: createdBy
            ? {
                id: createdBy.id,
                name: createdBy.name ?? createdBy.email ?? "Unknown",
              }
            : null,
        };
      })
    );

    // Sort by creation time (oldest first for approval)
    txsWithDetails.sort((a, b) => a._creationTime - b._creationTime);

    return txsWithDetails;
  },
});

// Check if user is the session creator
export const isSessionCreator = query({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    return game?.createdById === args.userId;
  },
});

// Create transaction (with auto-join and totals update)
// Transactions from non-creators require approval from session creator
export const createTransaction = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    type: transactionTypeValidator,
    amount: v.number(),
    description: v.optional(v.string()),
    createdById: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (args.amount < 0) {
      throw new Error("Amount must be non-negative");
    }
    // Get the game to check if creator
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.status !== "ACTIVE") {
      throw new Error("Transactions can only be added to active sessions");
    }

    const player = await ctx.db.get(args.playerId);
    if (!player || player.userId !== args.createdById) {
      throw new Error("You can only create transactions for your own player");
    }
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", game.groupId).eq("userId", args.createdById)
      )
      .first();
    if (!membership) {
      throw new Error("Only group members can add transactions");
    }

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

    // Transactions from non-creators are PENDING, session creator's transactions are auto-approved
    const isSessionCreator = game.createdById === args.createdById;
    const status = isSessionCreator ? "APPROVED" : "PENDING";

    // Create transaction
    const txId = await ctx.db.insert("transactions", {
      gameId: args.gameId,
      playerId: args.playerId,
      type: args.type,
      amount: args.amount,
      description: args.description,
      createdById: args.createdById,
      status,
    });

    if (gamePlayer && status === "APPROVED") {
      await recalculatePlayerTotals(ctx, args.gameId, args.playerId);
    }

    return { txId, status };
  },
});

// Delete transaction (session creator only)
export const deleteTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) {
      return;
    }

    // Check if user is the session creator
    const game = await ctx.db.get(tx.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.createdById !== args.userId) {
      throw new Error("Only the session creator can delete transactions");
    }

    const wasApproved = tx.status === "APPROVED" || tx.status === undefined;
    const { gameId, playerId } = tx;

    // Delete the transaction
    await ctx.db.delete(args.transactionId);

    // Recalculate totals if the transaction was approved
    if (wasApproved) {
      await recalculatePlayerTotals(ctx, gameId, playerId);
    }
  },
});

// Update transaction (session creator can edit any transaction)
export const updateTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    userId: v.id("users"),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { transactionId, userId, ...updates } = args;
    const tx = await ctx.db.get(transactionId);
    if (!tx) {
      return null;
    }
    if (updates.amount !== undefined && updates.amount < 0) {
      throw new Error("Amount must be non-negative");
    }

    // Check if user is the session creator
    const game = await ctx.db.get(tx.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.createdById !== userId) {
      throw new Error("Only the session creator can edit transactions");
    }

    // Update the transaction
    await ctx.db.patch(transactionId, updates);

    // Recalculate totals if this is an approved transaction and amount changed
    const isApproved = tx.status === "APPROVED" || tx.status === undefined;
    if (isApproved && args.amount !== undefined && args.amount !== tx.amount) {
      await recalculatePlayerTotals(ctx, tx.gameId, tx.playerId);
    }

    return await ctx.db.get(transactionId);
  },
});

// Approve a pending transaction request (session creator only)
export const approveTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) {
      throw new Error("Transaction not found");
    }

    // Check if user is the session creator
    const game = await ctx.db.get(tx.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.createdById !== args.userId) {
      throw new Error("Only the session creator can approve transactions");
    }

    if (tx.status !== "PENDING") {
      throw new Error("Transaction is not pending");
    }

    // Approve the transaction
    await ctx.db.patch(args.transactionId, { status: "APPROVED" });

    // Recalculate player totals
    await recalculatePlayerTotals(ctx, tx.gameId, tx.playerId);

    return await ctx.db.get(args.transactionId);
  },
});

// Reject a pending transaction request (session creator only)
export const rejectTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) {
      throw new Error("Transaction not found");
    }

    // Check if user is the session creator
    const game = await ctx.db.get(tx.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.createdById !== args.userId) {
      throw new Error("Only the session creator can reject transactions");
    }

    if (tx.status !== "PENDING") {
      throw new Error("Transaction is not pending");
    }

    // Reject the transaction
    await ctx.db.patch(args.transactionId, { status: "REJECTED" });

    return await ctx.db.get(args.transactionId);
  },
});

// Set player totals (session creator only)
export const setPlayerTotals = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    userId: v.id("users"),
    buyIn: v.number(),
    cashOut: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.buyIn < 0 || args.cashOut < 0) {
      throw new Error("Amounts must be non-negative");
    }

    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.createdById !== args.userId) {
      throw new Error("Only the session creator can edit player totals");
    }

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

    async function adjustTransactions(
      type: "buyin" | "cashout",
      desiredTotal: number
    ) {
      const txs = await ctx.db
        .query("transactions")
        .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
        .filter((q) =>
          q.and(
            q.eq(q.field("playerId"), args.playerId),
            q.eq(q.field("type"), type),
            q.or(
              q.eq(q.field("status"), "APPROVED"),
              q.eq(q.field("status"), undefined)
            )
          )
        )
        .collect();

      const currentTotal = txs.reduce((sum, tx) => sum + tx.amount, 0);

      if (desiredTotal > currentTotal) {
        const delta = desiredTotal - currentTotal;
        await ctx.db.insert("transactions", {
          gameId: args.gameId,
          playerId: args.playerId,
          type,
          amount: delta,
          createdById: args.userId,
          status: "APPROVED",
          description: "Adjustment by session creator",
        });
        return;
      }

      if (desiredTotal < currentTotal) {
        let remaining = currentTotal - desiredTotal;
        const sorted = [...txs].sort(
          (a, b) => b._creationTime - a._creationTime
        );
        for (const tx of sorted) {
          if (remaining <= 0) {
            break;
          }
          if (tx.amount > remaining) {
            await ctx.db.patch(tx._id, { amount: tx.amount - remaining });
            remaining = 0;
          } else {
            remaining -= tx.amount;
            await ctx.db.delete(tx._id);
          }
        }
      }
    }

    await adjustTransactions("buyin", args.buyIn);
    await adjustTransactions("cashout", args.cashOut);
    await recalculatePlayerTotals(ctx, args.gameId, args.playerId);

    return await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();
  },
});
