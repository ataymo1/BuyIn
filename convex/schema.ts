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
});
