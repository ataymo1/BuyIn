import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

// Get all groups for a user
export const getUserGroups = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const groupsWithDetails = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) {
          return null;
        }

        const members = await ctx.db
          .query("groupMembers")
          .withIndex("by_groupId", (q) => q.eq("groupId", membership.groupId))
          .collect();

        const activeGames = await ctx.db
          .query("games")
          .withIndex("by_groupId_status", (q) =>
            q.eq("groupId", membership.groupId).eq("status", "ACTIVE")
          )
          .collect();

        return {
          ...group,
          role: membership.role,
          memberCount: members.length,
          activeSessionCount: activeGames.length,
        };
      })
    );

    return groupsWithDetails.filter(Boolean);
  },
});

// Get single group with details
export const getGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return null;
    }

    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        // Get player record for this user
        const player = user
          ? await ctx.db
              .query("players")
              .withIndex("by_userId", (q) => q.eq("userId", user._id))
              .first()
          : null;
        return {
          ...member,
          user: user
            ? {
                id: user._id,
                name: player?.name ?? user.name ?? user.email ?? "Unknown",
                email: user.email,
                image: user.image,
              }
            : null,
        };
      })
    );

    const owner = await ctx.db.get(group.ownerId);
    // Get player record for owner
    const ownerPlayer = owner
      ? await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", owner._id))
          .first()
      : null;

    return {
      ...group,
      owner: owner
        ? {
            id: owner._id,
            name: ownerPlayer?.name ?? owner.name ?? owner.email ?? "Unknown",
            email: owner.email,
          }
        : null,
      members: membersWithUsers,
    };
  },
});

// Check if user is group member
export const isGroupMember = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    return !!member;
  },
});

// Check if user is group owner
export const isGroupOwner = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    return member?.role === "OWNER";
  },
});

// Get group standings (leaderboard)
export const getGroupStandings = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const gameIds = games.map((g) => g._id);

    // Get all game players for these games
    const allGamePlayers = await Promise.all(
      gameIds.map((gameId) =>
        ctx.db
          .query("gamePlayers")
          .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
          .collect()
      )
    );

    const flatGamePlayers = allGamePlayers.flat();

    // Aggregate by player
    const playerStats: Record<
      string,
      { playerId: Id<"players">; totalProfit: number; gamesPlayed: number }
    > = {};

    for (const gp of flatGamePlayers) {
      const key = gp.playerId as string;
      if (!playerStats[key]) {
        playerStats[key] = {
          playerId: gp.playerId,
          totalProfit: 0,
          gamesPlayed: 0,
        };
      }
      playerStats[key].totalProfit += gp.profit ?? 0;
      playerStats[key].gamesPlayed += 1;
    }

    // Get player details
    const standings = await Promise.all(
      Object.values(playerStats).map(async (stat) => {
        const player = await ctx.db.get(stat.playerId);
        return {
          player: player ? { id: player._id, name: player.name } : null,
          totalProfit: stat.totalProfit,
          gamesPlayed: stat.gamesPlayed,
        };
      })
    );

    return standings
      .filter((s) => s.player)
      .sort((a, b) => b.totalProfit - a.totalProfit);
  },
});

// Create group
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const groupId = await ctx.db.insert("groups", {
      name: args.name.trim(),
      description: args.description?.trim(),
      ownerId: args.ownerId,
    });

    // Add owner as member
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: args.ownerId,
      role: "OWNER",
      joinedAt: Date.now(),
    });

    return groupId;
  },
});

// Update group
export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { groupId, ...updates } = args;
    await ctx.db.patch(groupId, updates);
    return await ctx.db.get(groupId);
  },
});

// Delete group
export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    // Delete all group members
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all games in group
    const games = await ctx.db
      .query("games")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const game of games) {
      await ctx.db.delete(game._id);
    }

    await ctx.db.delete(args.groupId);
  },
});

// Add member to group
export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.optional(v.union(v.literal("OWNER"), v.literal("MEMBER"))),
  },
  handler: async (ctx, args) => {
    // Check if already a member
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      role: args.role ?? "MEMBER",
      joinedAt: Date.now(),
    });
  },
});

// Remove member from group
export const removeMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (member) {
      await ctx.db.delete(member._id);
    }
  },
});

// Search for groups by name
export const searchGroups = query({
  args: { searchTerm: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      return [];
    }

    // Search for groups by name
    const groups = await ctx.db
      .query("groups")
      .withSearchIndex("search_by_name", (q) =>
        q.search("name", args.searchTerm)
      )
      .take(20);

    // Get user's existing memberships
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const memberGroupIds = new Set(memberships.map((m) => m.groupId));

    // Get user's pending requests
    const pendingRequests = await ctx.db
      .query("joinRequests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "PENDING"))
      .collect();
    const pendingGroupIds = new Set(pendingRequests.map((r) => r.groupId));

    // Enrich groups with member count and request status
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const members = await ctx.db
          .query("groupMembers")
          .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
          .collect();

        const owner = await ctx.db.get(group.ownerId);

        return {
          ...group,
          memberCount: members.length,
          ownerName: owner?.name ?? owner?.email ?? "Unknown",
          isMember: memberGroupIds.has(group._id),
          hasPendingRequest: pendingGroupIds.has(group._id),
        };
      })
    );

    return enrichedGroups;
  },
});

// Request to join a group
export const requestToJoin = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already a member
    const existingMember = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (existingMember) {
      throw new Error("Already a member of this group");
    }

    // Check for existing pending request
    const existingRequest = await ctx.db
      .query("joinRequests")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "PENDING"))
      .first();

    if (existingRequest) {
      throw new Error("A pending request already exists for this group");
    }

    return await ctx.db.insert("joinRequests", {
      groupId: args.groupId,
      userId: args.userId,
      status: "PENDING",
      requestedAt: Date.now(),
      message: args.message?.trim(),
    });
  },
});

// Get pending requests for a group (owner only)
export const getPendingRequests = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify user is the owner
    const group = await ctx.db.get(args.groupId);
    if (!group || group.ownerId !== args.userId) {
      return [];
    }

    const requests = await ctx.db
      .query("joinRequests")
      .withIndex("by_groupId_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "PENDING")
      )
      .collect();

    // Enrich with user details
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const user = await ctx.db.get(request.userId);
        // Get player record for this user
        const player = user
          ? await ctx.db
              .query("players")
              .withIndex("by_userId", (q) => q.eq("userId", user._id))
              .first()
          : null;
        return {
          ...request,
          user: user
            ? {
                id: user._id,
                name: player?.name ?? user.name ?? user.email ?? "Unknown",
                email: user.email,
                image: user.image,
              }
            : null,
        };
      })
    );

    return enrichedRequests;
  },
});

// Approve a join request (owner only)
export const approveRequest = mutation({
  args: { requestId: v.id("joinRequests"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    // Verify user is the owner
    const group = await ctx.db.get(request.groupId);
    if (!group || group.ownerId !== args.userId) {
      throw new Error("Not authorized to approve requests for this group");
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "APPROVED",
      respondedAt: Date.now(),
    });

    // Add user as member
    await ctx.db.insert("groupMembers", {
      groupId: request.groupId,
      userId: request.userId,
      role: "MEMBER",
      joinedAt: Date.now(),
    });

    return { success: true };
  },
});

// Reject a join request (owner only)
export const rejectRequest = mutation({
  args: { requestId: v.id("joinRequests"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    // Verify user is the owner
    const group = await ctx.db.get(request.groupId);
    if (!group || group.ownerId !== args.userId) {
      throw new Error("Not authorized to reject requests for this group");
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "REJECTED",
      respondedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get user's pending join requests
export const getUserPendingRequests = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("joinRequests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "PENDING"))
      .collect();

    // Enrich with group details
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const group = await ctx.db.get(request.groupId);
        return {
          ...request,
          group: group
            ? {
                id: group._id,
                name: group.name,
                description: group.description,
              }
            : null,
        };
      })
    );

    return enrichedRequests;
  },
});

// Cancel a join request (requester only)
export const cancelJoinRequest = mutation({
  args: { requestId: v.id("joinRequests"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.userId !== args.userId) {
      throw new Error("Not authorized to cancel this request");
    }

    if (request.status !== "PENDING") {
      throw new Error("Can only cancel pending requests");
    }

    await ctx.db.delete(args.requestId);
    return { success: true };
  },
});
