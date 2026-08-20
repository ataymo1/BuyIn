import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // NextAuth tables
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    description: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    venmo: v.optional(v.string()),
    zelle: v.optional(v.string()),
    profilePrivate: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  accounts: defineTable({
    userId: v.id("users"),
    type: v.string(),
    provider: v.string(),
    providerAccountId: v.string(),
    refresh_token: v.optional(v.string()),
    access_token: v.optional(v.string()),
    expires_at: v.optional(v.number()),
    token_type: v.optional(v.string()),
    scope: v.optional(v.string()),
    id_token: v.optional(v.string()),
    session_state: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_provider_providerAccountId", ["provider", "providerAccountId"]),

  sessions: defineTable({
    userId: v.id("users"),
    sessionToken: v.string(),
    expires: v.number(),
  })
    .index("by_sessionToken", ["sessionToken"])
    .index("by_userId", ["userId"]),

  verificationTokens: defineTable({
    identifier: v.string(),
    token: v.string(),
    expires: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_identifier_token", ["identifier", "token"]),

  // Application tables
  players: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  pokerNowAliases: defineTable({
    groupId: v.id("groups"),
    sourcePlayerId: v.string(),
    displayName: v.string(),
    playerId: v.id("players"),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_sourcePlayerId", ["groupId", "sourcePlayerId"]),

  pokerNowImportRequests: defineTable({
    groupId: v.id("groups"),
    requestedById: v.id("users"),
    sourceId: v.string(),
    date: v.number(),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    handCount: v.number(),
    players: v.array(
      v.object({
        sourcePlayerId: v.string(),
        displayName: v.string(),
        buyIn: v.number(),
        cashOut: v.number(),
        playerId: v.optional(v.id("players")),
      })
    ),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED")
    ),
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
    respondedById: v.optional(v.id("users")),
    gameId: v.optional(v.id("games")),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_status", ["groupId", "status"])
    .index("by_groupId_sourceId", ["groupId", "sourceId"]),

  playerClaimRequests: defineTable({
    groupId: v.id("groups"),
    sourcePlayerId: v.id("players"),
    claimantUserId: v.id("users"),
    targetPlayerId: v.id("players"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED")
    ),
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
    respondedById: v.optional(v.id("users")),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_status", ["groupId", "status"])
    .index("by_groupId_sourcePlayerId", ["groupId", "sourcePlayerId"])
    .index("by_groupId_claimantUserId", ["groupId", "claimantUserId"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
  })
    .index("by_ownerId", ["ownerId"])
    .searchIndex("search_by_name", { searchField: "name" }),

  joinRequests: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED")
    ),
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
    message: v.optional(v.string()),
  })
    .index("by_groupId", ["groupId"])
    .index("by_userId", ["userId"])
    .index("by_groupId_status", ["groupId", "status"])
    .index("by_groupId_userId", ["groupId", "userId"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("OWNER"), v.literal("MEMBER")),
    joinedAt: v.number(),
  })
    .index("by_groupId", ["groupId"])
    .index("by_userId", ["userId"])
    .index("by_groupId_userId", ["groupId", "userId"]),

  games: defineTable({
    date: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    ),
    gameType: v.optional(v.union(v.literal("cash"), v.literal("tournament"))),
    livePokerEnabled: v.optional(v.boolean()),
    liveStatus: v.optional(
      v.union(
        v.literal("WAITING"),
        v.literal("PLAYING"),
        v.literal("PAUSED"),
        v.literal("CLOSED")
      )
    ),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    minBuyIn: v.optional(v.number()),
    maxBuyIn: v.optional(v.number()),
    seatCount: v.optional(v.number()),
    groupId: v.id("groups"),
    createdById: v.id("users"),
    importSource: v.optional(v.literal("POKER_NOW")),
    importSourceId: v.optional(v.string()),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_status", ["groupId", "status"])
    .index("by_createdById", ["createdById"])
    .index("by_groupId_importSourceId", ["groupId", "importSourceId"]),

  gamePlayers: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    buyIn: v.number(),
    cashOut: v.optional(v.number()),
    profit: v.optional(v.number()),
  })
    .index("by_gameId", ["gameId"])
    .index("by_playerId", ["playerId"])
    .index("by_gameId_playerId", ["gameId", "playerId"]),

  transactions: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    type: v.union(v.literal("buyin"), v.literal("cashout")),
    amount: v.number(),
    description: v.optional(v.string()),
    createdById: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("PENDING"),
        v.literal("APPROVED"),
        v.literal("REJECTED")
      )
    ), // Buy-ins require approval from session creator
  })
    .index("by_gameId", ["gameId"])
    .index("by_playerId", ["playerId"])
    .index("by_createdById", ["createdById"])
    .index("by_gameId_status", ["gameId", "status"]),

  livePokerAccessGrants: defineTable({
    expiresAt: v.number(),
    tableId: v.id("livePokerTables"),
    updatedAt: v.number(),
    userId: v.id("users"),
  })
    .index("by_userId_expiresAt", ["userId", "expiresAt"])
    .index("by_userId_tableId", ["userId", "tableId"]),

  livePokerTables: defineTable({
    title: v.string(),
    status: v.union(
      v.literal("OPEN"),
      v.literal("CLOSED"),
      v.literal("CANCELLED")
    ),
    liveStatus: v.union(
      v.literal("WAITING"),
      v.literal("PLAYING"),
      v.literal("PAUSED"),
      v.literal("CLOSED")
    ),
    smallBlind: v.number(),
    bigBlind: v.number(),
    minBuyIn: v.number(),
    maxBuyIn: v.number(),
    seatCount: v.number(),
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdById", ["createdById"])
    .index("by_createdById_status", ["createdById", "status"])
    .index("by_createdById_createdAt", ["createdById", "createdAt"]),

  livePokerTablePlayers: defineTable({
    tableId: v.id("livePokerTables"),
    playerId: v.id("players"),
    userId: v.id("users"),
    buyIn: v.number(),
    cashOut: v.optional(v.number()),
    profit: v.optional(v.number()),
    lastSettledAt: v.optional(v.number()),
    lastSettlementId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_tableId", ["tableId"])
    .index("by_playerId", ["playerId"])
    .index("by_tableId_playerId", ["tableId", "playerId"]),

  livePokerSettlementEvents: defineTable({
    appliedAt: v.number(),
    playerId: v.id("players"),
    settledAt: v.optional(v.number()),
    settlementId: v.string(),
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
  })
    .index("by_settlementId", ["settlementId"])
    .index("by_tableId", ["tableId"]),

  livePokerBuyInRequests: defineTable({
    tableId: v.id("livePokerTables"),
    userId: v.id("users"),
    playerId: v.id("players"),
    seatIndex: v.optional(v.number()),
    amount: v.number(),
    type: v.union(v.literal("INITIAL"), v.literal("ADD_ON")),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("CLAIMED")
    ),
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
    respondedById: v.optional(v.id("users")),
    claimedAt: v.optional(v.number()),
    claimedById: v.optional(v.id("users")),
  })
    .index("by_tableId", ["tableId"])
    .index("by_tableId_status", ["tableId", "status"])
    .index("by_tableId_userId", ["tableId", "userId"])
    .index("by_userId_status", ["userId", "status"]),

  livePokerHands: defineTable({
    gameId: v.optional(v.id("games")),
    tableId: v.optional(v.id("livePokerTables")),
    handNumber: v.number(),
    dealerSeat: v.number(),
    smallBlind: v.number(),
    bigBlind: v.number(),
    communityCards: v.array(v.string()),
    winners: v.array(
      v.object({
        playerId: v.id("players"),
        userId: v.id("users"),
        seatIndex: v.number(),
        amount: v.number(),
        description: v.optional(v.string()),
      })
    ),
    pot: v.number(),
    actionLog: v.array(v.string()),
    completedAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_gameId_handNumber", ["gameId", "handNumber"])
    .index("by_tableId", ["tableId"])
    .index("by_tableId_handNumber", ["tableId", "handNumber"]),
});
