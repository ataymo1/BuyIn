import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalMutation, query } from "./_generated/server";

const winnerValidator = v.object({
  playerId: v.id("players"),
  userId: v.id("users"),
  seatIndex: v.number(),
  amount: v.number(),
  description: v.optional(v.string()),
});

const buyInRequestTypeValidator = v.union(
  v.literal("INITIAL"),
  v.literal("ADD_ON")
);

export const recordCompletedHandInternal = internalMutation({
  args: {
    gameId: v.optional(v.id("games")),
    tableId: v.optional(v.id("livePokerTables")),
    handNumber: v.number(),
    dealerSeat: v.number(),
    smallBlind: v.number(),
    bigBlind: v.number(),
    communityCards: v.array(v.string()),
    winners: v.array(winnerValidator),
    pot: v.number(),
    actionLog: v.array(v.string()),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    if (!(args.gameId || args.tableId)) {
      throw new Error("A gameId or tableId is required");
    }

    const existing = await ctx.db
      .query("livePokerHands")
      .withIndex(
        args.tableId ? "by_tableId_handNumber" : "by_gameId_handNumber",
        (q) =>
          args.tableId
            ? q.eq("tableId", args.tableId).eq("handNumber", args.handNumber)
            : q.eq("gameId", args.gameId).eq("handNumber", args.handNumber)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("livePokerHands", args);
  },
});

function validateTableSettings(args: {
  bigBlind: number;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}) {
  if (
    [
      args.bigBlind,
      args.maxBuyIn,
      args.minBuyIn,
      args.seatCount,
      args.smallBlind,
    ].some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Live poker settings must be finite numbers");
  }
  if (args.smallBlind <= 0 || args.bigBlind < args.smallBlind) {
    throw new Error("Live poker requires valid blinds");
  }
  if (
    args.seatCount < 2 ||
    args.seatCount > 9 ||
    !Number.isInteger(args.seatCount)
  ) {
    throw new Error("Live poker tables must have 2 to 9 seats");
  }
  if (args.minBuyIn < 0 || args.maxBuyIn < args.minBuyIn) {
    throw new Error("Max buy-in must be at least the min buy-in");
  }
}

async function getRequestDetails(
  ctx: QueryCtx,
  request: {
    playerId: Id<"players">;
    respondedById?: Id<"users">;
    userId: Id<"users">;
  }
) {
  const player = await ctx.db.get(request.playerId);
  const user = await ctx.db.get(request.userId);
  const respondedBy = request.respondedById
    ? await ctx.db.get(request.respondedById)
    : null;

  return {
    player: {
      id: request.playerId,
      name: player?.name ?? user?.name ?? user?.email ?? "Player",
    },
    respondedBy: respondedBy
      ? {
          id: request.respondedById,
          name: respondedBy.name ?? respondedBy.email ?? "Host",
        }
      : null,
  };
}

async function handleExistingPendingBuyInRequest(
  ctx: MutationCtx,
  args: {
    amount: number;
    pendingRequestId?: Id<"livePokerBuyInRequests">;
    seatIndex?: number;
    type: "ADD_ON" | "INITIAL";
  }
) {
  if (!args.pendingRequestId) {
    return null;
  }

  await ctx.db.patch(args.pendingRequestId, {
    amount: args.amount,
    requestedAt: Date.now(),
    seatIndex: args.type === "INITIAL" ? args.seatIndex : undefined,
  });

  return args.pendingRequestId;
}

export const createLivePokerTableInternal = internalMutation({
  args: {
    title: v.string(),
    createdById: v.id("users"),
    smallBlind: v.number(),
    bigBlind: v.number(),
    minBuyIn: v.number(),
    maxBuyIn: v.number(),
    seatCount: v.number(),
  },
  handler: async (ctx, args) => {
    validateTableSettings(args);

    const now = Date.now();
    return await ctx.db.insert("livePokerTables", {
      title: args.title.trim() || "Untitled Table",
      status: "OPEN",
      liveStatus: "WAITING",
      smallBlind: args.smallBlind,
      bigBlind: args.bigBlind,
      minBuyIn: args.minBuyIn,
      maxBuyIn: args.maxBuyIn,
      seatCount: args.seatCount,
      createdById: args.createdById,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listLivePokerTables = query({
  args: {
    currentUserId: v.optional(v.id("users")),
    includeClosed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const tables = args.includeClosed
      ? await ctx.db.query("livePokerTables").collect()
      : await ctx.db
          .query("livePokerTables")
          .withIndex("by_status", (q) => q.eq("status", "OPEN"))
          .collect();

    const rows = await Promise.all(
      tables.map(async (table) => {
        const createdBy = await ctx.db.get(table.createdById);
        const player = await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", table.createdById))
          .first();
        const tablePlayers = await ctx.db
          .query("livePokerTablePlayers")
          .withIndex("by_tableId", (q) => q.eq("tableId", table._id))
          .collect();
        const isCurrentUserSettled = args.currentUserId
          ? tablePlayers.some(
              (tablePlayer) => tablePlayer.userId === args.currentUserId
            )
          : false;

        return {
          ...table,
          id: table._id,
          createdBy: {
            id: table.createdById,
            name: player?.name ?? createdBy?.name ?? createdBy?.email ?? "Host",
          },
          isCreatedByCurrentUser: table.createdById === args.currentUserId,
          isCurrentUserSettled,
          settledPlayerCount: tablePlayers.length,
        };
      })
    );

    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getLivePokerTable = query({
  args: { tableId: v.id("livePokerTables") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table) {
      return null;
    }

    const createdBy = await ctx.db.get(table.createdById);
    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", table.createdById))
      .first();

    return {
      ...table,
      id: table._id,
      createdBy: {
        id: table.createdById,
        name: player?.name ?? createdBy?.name ?? createdBy?.email ?? "Host",
      },
    };
  },
});

export const getLivePokerAccess = query({
  args: { tableId: v.id("livePokerTables"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table || table.status !== "OPEN") {
      return null;
    }

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      table: {
        id: table._id,
        title: table.title,
        createdById: table.createdById,
        liveStatus: table.liveStatus,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        minBuyIn: table.minBuyIn,
        maxBuyIn: table.maxBuyIn,
        seatCount: table.seatCount,
      },
      player: player ? { id: player._id, name: player.name } : null,
    };
  },
});

export const createLivePokerBuyInRequestInternal = internalMutation({
  args: {
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
    playerId: v.id("players"),
    seatIndex: v.optional(v.number()),
    amount: v.number(),
    type: buyInRequestTypeValidator,
  },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table || table.status !== "OPEN") {
      throw new Error("Table not found");
    }

    const player = await ctx.db.get(args.playerId);
    if (!player || player.userId !== args.userId) {
      throw new Error("Player profile does not match this user");
    }

    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new Error("Buy-in amount must be a positive finite number");
    }

    if (args.type === "INITIAL") {
      if (
        args.seatIndex === undefined ||
        args.seatIndex < 0 ||
        args.seatIndex >= table.seatCount ||
        !Number.isInteger(args.seatIndex)
      ) {
        throw new Error("Choose a valid seat");
      }
      if (args.amount < table.minBuyIn || args.amount > table.maxBuyIn) {
        throw new Error(
          `Buy-in must be between ${table.minBuyIn} and ${table.maxBuyIn}`
        );
      }
    }

    if (args.type === "ADD_ON" && args.amount > table.maxBuyIn) {
      throw new Error(`Add-on cannot exceed ${table.maxBuyIn}`);
    }

    const pendingRequests = await ctx.db
      .query("livePokerBuyInRequests")
      .withIndex("by_tableId_userId", (q) =>
        q.eq("tableId", args.tableId).eq("userId", args.userId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), args.type),
          q.eq(q.field("status"), "PENDING")
        )
      )
      .collect();

    const existingRequestId = await handleExistingPendingBuyInRequest(ctx, {
      amount: args.amount,
      pendingRequestId: pendingRequests[0]?._id,
      seatIndex: args.seatIndex,
      type: args.type,
    });
    if (existingRequestId) {
      return existingRequestId;
    }

    const now = Date.now();

    return await ctx.db.insert("livePokerBuyInRequests", {
      tableId: args.tableId,
      userId: args.userId,
      playerId: args.playerId,
      seatIndex: args.type === "INITIAL" ? args.seatIndex : undefined,
      amount: args.amount,
      type: args.type,
      status: "PENDING",
      requestedAt: now,
    });
  },
});

export const getPendingLivePokerBuyInRequests = query({
  args: {
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table || table.createdById !== args.userId) {
      return [];
    }

    const requests = await ctx.db
      .query("livePokerBuyInRequests")
      .withIndex("by_tableId_status", (q) =>
        q.eq("tableId", args.tableId).eq("status", "PENDING")
      )
      .collect();

    const rows = await Promise.all(
      requests.map(async (request) => ({
        ...request,
        id: request._id,
        ...(await getRequestDetails(ctx, request)),
      }))
    );

    return rows.sort((a, b) => a.requestedAt - b.requestedAt);
  },
});

export const getUserLivePokerBuyInRequests = query({
  args: {
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("livePokerBuyInRequests")
      .withIndex("by_tableId_userId", (q) =>
        q.eq("tableId", args.tableId).eq("userId", args.userId)
      )
      .collect();

    const visibleRequests = requests.filter((request) =>
      ["PENDING", "APPROVED", "REJECTED"].includes(request.status)
    );
    const rows = await Promise.all(
      visibleRequests.map(async (request) => ({
        ...request,
        id: request._id,
        ...(await getRequestDetails(ctx, request)),
      }))
    );

    return rows.sort((a, b) => b.requestedAt - a.requestedAt);
  },
});

export const getLivePokerBuyInRequestForClaim = query({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.userId !== args.userId ||
      !["APPROVED", "CLAIMED"].includes(request.status)
    ) {
      return null;
    }

    const table = await ctx.db.get(request.tableId);
    if (!table || table.status !== "OPEN") {
      return null;
    }

    return {
      ...request,
      id: request._id,
      table: {
        id: table._id,
        bigBlind: table.bigBlind,
        createdById: table.createdById,
        maxBuyIn: table.maxBuyIn,
        minBuyIn: table.minBuyIn,
        seatCount: table.seatCount,
        smallBlind: table.smallBlind,
      },
    };
  },
});

export const getLivePokerBuyInRequestForApproval = query({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!(request && ["PENDING", "CLAIMED"].includes(request.status))) {
      return null;
    }

    const table = await ctx.db.get(request.tableId);
    if (
      !table ||
      table.status !== "OPEN" ||
      table.createdById !== args.userId
    ) {
      return null;
    }

    const player = await ctx.db.get(request.playerId);
    const user = await ctx.db.get(request.userId);

    return {
      ...request,
      id: request._id,
      playerName: player?.name ?? user?.name ?? user?.email ?? "Player",
      table: {
        id: table._id,
        bigBlind: table.bigBlind,
        createdById: table.createdById,
        maxBuyIn: table.maxBuyIn,
        minBuyIn: table.minBuyIn,
        seatCount: table.seatCount,
        smallBlind: table.smallBlind,
      },
    };
  },
});

export const respondToLivePokerBuyInRequestInternal = internalMutation({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    userId: v.id("users"),
    status: v.literal("REJECTED"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const table = await ctx.db.get(request.tableId);
    if (!table) {
      throw new Error("Table not found");
    }
    if (table.createdById !== args.userId) {
      throw new Error("Only the table creator can respond to buy-ins");
    }
    if (request.status !== "PENDING") {
      throw new Error("Request is not pending");
    }

    await ctx.db.patch(args.requestId, {
      status: args.status,
      respondedAt: Date.now(),
      respondedById: args.userId,
    });

    return await ctx.db.get(args.requestId);
  },
});

export const markLivePokerBuyInRequestClaimedInternal = internalMutation({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }
    if (request.userId !== args.userId) {
      throw new Error("Only the requester can claim this buy-in");
    }
    if (request.status === "CLAIMED") {
      return request;
    }
    if (request.status !== "APPROVED") {
      throw new Error("Request is not approved");
    }

    await ctx.db.patch(args.requestId, {
      status: "CLAIMED",
      claimedAt: Date.now(),
      claimedById: args.userId,
    });

    return await ctx.db.get(args.requestId);
  },
});

export const approveAndMarkLivePokerBuyInRequestClaimedInternal =
  internalMutation({
    args: {
      requestId: v.id("livePokerBuyInRequests"),
      userId: v.id("users"),
    },
    handler: async (ctx, args) => {
      const request = await ctx.db.get(args.requestId);
      if (!request) {
        throw new Error("Request not found");
      }

      const table = await ctx.db.get(request.tableId);
      if (!table) {
        throw new Error("Table not found");
      }
      if (table.createdById !== args.userId) {
        throw new Error("Only the table creator can approve buy-ins");
      }
      if (request.status === "CLAIMED") {
        return request;
      }
      if (request.status !== "PENDING") {
        throw new Error("Request is not pending");
      }

      const now = Date.now();
      await ctx.db.patch(args.requestId, {
        status: "CLAIMED",
        respondedAt: now,
        respondedById: args.userId,
        claimedAt: now,
        claimedById: request.userId,
      });

      return await ctx.db.get(args.requestId);
    },
  });

export const updateLivePokerStatusInternal = internalMutation({
  args: {
    tableId: v.id("livePokerTables"),
    liveStatus: v.union(
      v.literal("WAITING"),
      v.literal("PLAYING"),
      v.literal("PAUSED"),
      v.literal("CLOSED")
    ),
  },
  handler: async (ctx, args) => {
    const updates =
      args.liveStatus === "CLOSED"
        ? {
            liveStatus: args.liveStatus,
            status: "CLOSED" as const,
            updatedAt: Date.now(),
          }
        : {
            liveStatus: args.liveStatus,
            updatedAt: Date.now(),
          };

    await ctx.db.patch(args.tableId, updates);
    return await ctx.db.get(args.tableId);
  },
});

export const deleteLivePokerTableInternal = internalMutation({
  args: {
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.tableId);
    if (!table) {
      return;
    }

    if (table.createdById !== args.userId) {
      throw new Error("Only the table creator can delete this table");
    }

    // Preserve the ledger and hand history. The worker has already closed
    // admissions and durably queued every seat settlement before this runs.
    await ctx.db.patch(args.tableId, {
      liveStatus: "CLOSED",
      status: "CANCELLED",
      updatedAt: Date.now(),
    });
  },
});

export const settlePlayerStackInternal = internalMutation({
  args: {
    gameId: v.optional(v.id("games")),
    tableId: v.optional(v.id("livePokerTables")),
    playerId: v.id("players"),
    userId: v.id("users"),
    buyIn: v.number(),
    cashOut: v.number(),
    settledAt: v.optional(v.number()),
    settlementId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (
      !(Number.isFinite(args.buyIn) && Number.isFinite(args.cashOut)) ||
      args.buyIn < 0 ||
      args.cashOut < 0
    ) {
      throw new Error("Amounts must be finite and non-negative");
    }

    if (args.tableId) {
      const tableId = args.tableId;
      const table = await ctx.db.get(tableId);
      if (!table) {
        throw new Error("Table not found");
      }

      const existing = await ctx.db
        .query("livePokerTablePlayers")
        .withIndex("by_tableId_playerId", (q) =>
          q.eq("tableId", tableId).eq("playerId", args.playerId)
        )
        .first();

      if (
        (args.settlementId !== undefined &&
          existing?.lastSettlementId === args.settlementId) ||
        (existing?.lastSettledAt !== undefined &&
          args.settledAt !== undefined &&
          existing.lastSettledAt > args.settledAt)
      ) {
        return existing;
      }

      const settlementMetadata = {
        lastSettledAt: args.settledAt,
        lastSettlementId: args.settlementId,
        updatedAt: Date.now(),
      };

      if (existing) {
        const buyIn = existing.buyIn + args.buyIn;
        const cashOut = (existing.cashOut ?? 0) + args.cashOut;
        await ctx.db.patch(existing._id, {
          ...settlementMetadata,
          buyIn,
          cashOut,
          profit: cashOut - buyIn,
        });
        return await ctx.db.get(existing._id);
      }

      return await ctx.db.insert("livePokerTablePlayers", {
        tableId,
        playerId: args.playerId,
        userId: args.userId,
        ...settlementMetadata,
        buyIn: args.buyIn,
        cashOut: args.cashOut,
        profit: args.cashOut - args.buyIn,
      });
    }

    if (!args.gameId) {
      throw new Error("A gameId or tableId is required");
    }

    const gameId = args.gameId;
    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    let gamePlayer = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId_playerId", (q) =>
        q.eq("gameId", gameId).eq("playerId", args.playerId)
      )
      .first();

    if (!gamePlayer) {
      const gamePlayerId = await ctx.db.insert("gamePlayers", {
        gameId,
        playerId: args.playerId,
        buyIn: 0,
      });
      gamePlayer = await ctx.db.get(gamePlayerId);
    }

    if (!gamePlayer) {
      throw new Error("Unable to create player record for game");
    }

    await ctx.db.patch(gamePlayer._id, {
      buyIn: args.buyIn,
      cashOut: args.cashOut,
      profit: args.cashOut - args.buyIn,
    });

    return await ctx.db.get(gamePlayer._id);
  },
});

function assertLivePokerServerSecret(secret: string) {
  const expected =
    process.env.LIVE_POKER_CONVEX_SECRET ??
    process.env.LIVE_POKER_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized live poker server operation");
  }
}

export const serverCreateLivePokerTable = action({
  args: {
    bigBlind: v.number(),
    createdById: v.id("users"),
    maxBuyIn: v.number(),
    minBuyIn: v.number(),
    seatCount: v.number(),
    secret: v.string(),
    smallBlind: v.number(),
    title: v.string(),
  },
  handler: async (ctx, { secret, ...args }): Promise<Id<"livePokerTables">> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.createLivePokerTableInternal,
      args
    );
  },
});

export const serverCreateLivePokerBuyInRequest = action({
  args: {
    amount: v.number(),
    playerId: v.id("players"),
    seatIndex: v.optional(v.number()),
    secret: v.string(),
    tableId: v.id("livePokerTables"),
    type: buyInRequestTypeValidator,
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { secret, ...args }
  ): Promise<Id<"livePokerBuyInRequests">> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.createLivePokerBuyInRequestInternal,
      args
    );
  },
});

export const serverRejectLivePokerBuyInRequest = action({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    secret: v.string(),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { secret, ...args }
  ): Promise<Doc<"livePokerBuyInRequests"> | null> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.respondToLivePokerBuyInRequestInternal,
      { ...args, status: "REJECTED" }
    );
  },
});

export const serverMarkLivePokerBuyInRequestClaimed = action({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    secret: v.string(),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { secret, ...args }
  ): Promise<Doc<"livePokerBuyInRequests"> | null> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.markLivePokerBuyInRequestClaimedInternal,
      args
    );
  },
});

export const serverApproveLivePokerBuyInRequest = action({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    secret: v.string(),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { secret, ...args }
  ): Promise<Doc<"livePokerBuyInRequests"> | null> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.approveAndMarkLivePokerBuyInRequestClaimedInternal,
      args
    );
  },
});

export const serverDeleteLivePokerTable = action({
  args: {
    secret: v.string(),
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, { secret, ...args }): Promise<void> => {
    assertLivePokerServerSecret(secret);
    await ctx.runMutation(
      internal.live_poker.deleteLivePokerTableInternal,
      args
    );
  },
});

export const serverRecordCompletedHand = action({
  args: {
    actionLog: v.array(v.string()),
    bigBlind: v.number(),
    communityCards: v.array(v.string()),
    completedAt: v.number(),
    dealerSeat: v.number(),
    gameId: v.optional(v.id("games")),
    handNumber: v.number(),
    pot: v.number(),
    secret: v.string(),
    smallBlind: v.number(),
    tableId: v.optional(v.id("livePokerTables")),
    winners: v.array(winnerValidator),
  },
  handler: async (ctx, { secret, ...args }): Promise<Id<"livePokerHands">> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.recordCompletedHandInternal,
      args
    );
  },
});

export const serverSettlePlayerStack = action({
  args: {
    buyIn: v.number(),
    cashOut: v.number(),
    gameId: v.optional(v.id("games")),
    playerId: v.id("players"),
    secret: v.string(),
    settledAt: v.optional(v.number()),
    settlementId: v.optional(v.string()),
    tableId: v.optional(v.id("livePokerTables")),
    userId: v.id("users"),
  },
  handler: async (ctx, { secret, ...args }): Promise<unknown> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runMutation(
      internal.live_poker.settlePlayerStackInternal,
      args
    );
  },
});
