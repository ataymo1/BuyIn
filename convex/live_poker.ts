import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

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
const LIVE_POKER_ACCESS_GRANT_MS = 15 * 60 * 1000;
const LIVE_POKER_ACCESS_GRANT_RENEWAL_MS = 6 * 60 * 1000;
const MAX_ACTIVE_LIVE_POKER_TABLES_PER_USER = 3;
const MAX_LIVE_POKER_TABLES_CREATED_PER_DAY = 10;
const MAX_OPEN_LIVE_POKER_TABLES_GLOBAL = 10;
const MAX_OPEN_LIVE_POKER_TABLES_PER_USER = 3;

type LivePokerBuyInRequestRow = Doc<"livePokerBuyInRequests"> & {
  id: Id<"livePokerBuyInRequests">;
  player: { id: Id<"players">; name: string };
  respondedBy: { id: Id<"users"> | undefined; name: string } | null;
};

interface LivePokerWorkerTable {
  bigBlind: number;
  createdById: Id<"users">;
  id: Id<"livePokerTables">;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}

type LivePokerClaimRequest = Doc<"livePokerBuyInRequests"> & {
  id: Id<"livePokerBuyInRequests">;
  table: LivePokerWorkerTable;
};

type LivePokerApprovalRequest = LivePokerClaimRequest & {
  playerName: string;
};

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

function isValidChipAmount(value: number, allowZero = false) {
  const units = Math.round(value * 100);
  return (
    Number.isFinite(value) &&
    Number.isSafeInteger(units) &&
    Math.abs(value * 100 - units) <= 1e-7 &&
    (allowZero ? units >= 0 : units > 0)
  );
}

function validateTableSettings(args: {
  bigBlind: number;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}) {
  const hasValidPositiveAmounts = [
    args.smallBlind,
    args.bigBlind,
    args.maxBuyIn,
  ].every((amount) => isValidChipAmount(amount));
  const hasValidAmounts =
    hasValidPositiveAmounts && isValidChipAmount(args.minBuyIn, true);
  if (!hasValidAmounts) {
    throw new Error(
      "Live poker amounts must be safe, non-negative 0.01 increments"
    );
  }
  if (args.bigBlind < args.smallBlind) {
    throw new Error("Live poker requires valid blinds");
  }
  if (
    args.seatCount < 2 ||
    args.seatCount > 9 ||
    !Number.isInteger(args.seatCount)
  ) {
    throw new Error("Live poker tables must have 2 to 9 seats");
  }
  if (args.maxBuyIn < args.minBuyIn) {
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
    const globallyOpenTables = await ctx.db
      .query("livePokerTables")
      .withIndex("by_status", (q) => q.eq("status", "OPEN"))
      .take(MAX_OPEN_LIVE_POKER_TABLES_GLOBAL);
    if (globallyOpenTables.length >= MAX_OPEN_LIVE_POKER_TABLES_GLOBAL) {
      throw new Error(
        `Live poker is limited to ${MAX_OPEN_LIVE_POKER_TABLES_GLOBAL} open tables across this deployment`
      );
    }
    const openTables = await ctx.db
      .query("livePokerTables")
      .withIndex("by_createdById_status", (q) =>
        q.eq("createdById", args.createdById).eq("status", "OPEN")
      )
      .take(MAX_OPEN_LIVE_POKER_TABLES_PER_USER);
    if (openTables.length >= MAX_OPEN_LIVE_POKER_TABLES_PER_USER) {
      throw new Error(
        `Close an existing table before creating more than ${MAX_OPEN_LIVE_POKER_TABLES_PER_USER} open tables`
      );
    }
    const recentlyCreatedTables = await ctx.db
      .query("livePokerTables")
      .withIndex("by_createdById_createdAt", (q) =>
        q
          .eq("createdById", args.createdById)
          .gte("createdAt", now - 24 * 60 * 60 * 1000)
      )
      .take(MAX_LIVE_POKER_TABLES_CREATED_PER_DAY);
    if (
      recentlyCreatedTables.length >= MAX_LIVE_POKER_TABLES_CREATED_PER_DAY
    ) {
      throw new Error(
        `Live poker table creation is limited to ${MAX_LIVE_POKER_TABLES_CREATED_PER_DAY} per day`
      );
    }

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

export const reserveLivePokerAccessInternal = internalMutation({
  args: {
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const table = await ctx.db.get(args.tableId);
    if (!table || table.status !== "OPEN") {
      throw new Error("Live poker table is not open");
    }

    const existing = await ctx.db
      .query("livePokerAccessGrants")
      .withIndex("by_userId_tableId", (q) =>
        q.eq("userId", args.userId).eq("tableId", args.tableId)
      )
      .first();
    if (existing && existing.expiresAt > now) {
      if (existing.expiresAt - now <= LIVE_POKER_ACCESS_GRANT_RENEWAL_MS) {
        await ctx.db.patch(existing._id, {
          expiresAt: now + LIVE_POKER_ACCESS_GRANT_MS,
          updatedAt: now,
        });
      }
      return;
    }

    const activeGrants = await ctx.db
      .query("livePokerAccessGrants")
      .withIndex("by_userId_expiresAt", (q) =>
        q.eq("userId", args.userId).gt("expiresAt", now)
      )
      .take(MAX_ACTIVE_LIVE_POKER_TABLES_PER_USER);
    if (activeGrants.length >= MAX_ACTIVE_LIVE_POKER_TABLES_PER_USER) {
      throw new Error(
        `Live poker access is limited to ${MAX_ACTIVE_LIVE_POKER_TABLES_PER_USER} active tables per user`
      );
    }

    const expiredGrants = await ctx.db
      .query("livePokerAccessGrants")
      .withIndex("by_userId_expiresAt", (q) =>
        q.eq("userId", args.userId).lte("expiresAt", now)
      )
      .take(10);
    for (const grant of expiredGrants) {
      if (grant._id !== existing?._id) {
        await ctx.db.delete(grant._id);
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        expiresAt: now + LIVE_POKER_ACCESS_GRANT_MS,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.insert("livePokerAccessGrants", {
      expiresAt: now + LIVE_POKER_ACCESS_GRANT_MS,
      tableId: args.tableId,
      updatedAt: now,
      userId: args.userId,
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

export const getPendingLivePokerBuyInRequests = internalQuery({
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

export const getUserLivePokerBuyInRequests = internalQuery({
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

export const getLivePokerBuyInRequestForClaim = internalQuery({
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

export const getLivePokerBuyInRequestForApproval = internalQuery({
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Game and live-table settlement paths share one atomic mutation, including event-based idempotency for out-of-order retries.
  handler: async (ctx, args) => {
    if (
      !(Number.isFinite(args.buyIn) && Number.isFinite(args.cashOut)) ||
      args.buyIn < 0 ||
      args.cashOut < 0
    ) {
      throw new Error("Amounts must be finite and non-negative");
    }

    if (args.tableId) {
      if (!args.settlementId) {
        throw new Error("A settlementId is required for live poker tables");
      }
      const settlementId = args.settlementId;
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

      const appliedSettlement = await ctx.db
        .query("livePokerSettlementEvents")
        .withIndex("by_settlementId", (q) =>
          q.eq("settlementId", settlementId)
        )
        .first();
      if (appliedSettlement) {
        return existing;
      }

      if (existing?.lastSettlementId === settlementId) {
        await ctx.db.insert("livePokerSettlementEvents", {
          appliedAt: Date.now(),
          playerId: args.playerId,
          settledAt: args.settledAt,
          settlementId,
          tableId,
          userId: args.userId,
        });
        return existing;
      }

      const settlementMetadata = {
        lastSettledAt:
          args.settledAt === undefined
            ? existing?.lastSettledAt
            : Math.max(existing?.lastSettledAt ?? 0, args.settledAt),
        lastSettlementId: settlementId,
        updatedAt: Date.now(),
      };
      let tablePlayerId: Id<"livePokerTablePlayers">;

      if (existing) {
        const buyIn = existing.buyIn + args.buyIn;
        const cashOut = (existing.cashOut ?? 0) + args.cashOut;
        await ctx.db.patch(existing._id, {
          ...settlementMetadata,
          buyIn,
          cashOut,
          profit: cashOut - buyIn,
        });
        tablePlayerId = existing._id;
      } else {
        tablePlayerId = await ctx.db.insert("livePokerTablePlayers", {
          tableId,
          playerId: args.playerId,
          userId: args.userId,
          ...settlementMetadata,
          buyIn: args.buyIn,
          cashOut: args.cashOut,
          profit: args.cashOut - args.buyIn,
        });
      }

      await ctx.db.insert("livePokerSettlementEvents", {
        appliedAt: Date.now(),
        playerId: args.playerId,
        settledAt: args.settledAt,
        settlementId,
        tableId,
        userId: args.userId,
      });
      return await ctx.db.get(tablePlayerId);
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
  const expected = process.env.LIVE_POKER_CONVEX_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized live poker server operation");
  }
}

export const serverGetLivePokerBuyInRequestForClaim = action({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    secret: v.string(),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { requestId, secret, userId }
  ): Promise<LivePokerClaimRequest | null> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runQuery(
      internal.live_poker.getLivePokerBuyInRequestForClaim,
      { requestId, userId }
    );
  },
});

export const serverGetLivePokerBuyInRequestForApproval = action({
  args: {
    requestId: v.id("livePokerBuyInRequests"),
    secret: v.string(),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { requestId, secret, userId }
  ): Promise<LivePokerApprovalRequest | null> => {
    assertLivePokerServerSecret(secret);
    return await ctx.runQuery(
      internal.live_poker.getLivePokerBuyInRequestForApproval,
      { requestId, userId }
    );
  },
});

export const serverGetLivePokerBuyInRequests = action({
  args: {
    secret: v.string(),
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    { secret, tableId, userId }
  ): Promise<{
    pending: LivePokerBuyInRequestRow[];
    user: LivePokerBuyInRequestRow[];
  }> => {
    assertLivePokerServerSecret(secret);
    const pending: LivePokerBuyInRequestRow[] = await ctx.runQuery(
      internal.live_poker.getPendingLivePokerBuyInRequests,
      { tableId, userId }
    );
    const user: LivePokerBuyInRequestRow[] = await ctx.runQuery(
      internal.live_poker.getUserLivePokerBuyInRequests,
      { tableId, userId }
    );
    return { pending, user };
  },
});

export const serverReserveLivePokerAccess = action({
  args: {
    secret: v.string(),
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  },
  handler: async (ctx, { secret, ...args }): Promise<void> => {
    assertLivePokerServerSecret(secret);
    await ctx.runMutation(
      internal.live_poker.reserveLivePokerAccessInternal,
      args
    );
  },
});

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
