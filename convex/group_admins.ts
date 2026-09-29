// biome-ignore-all lint/style/useFilenamingConvention: Convex exposes underscore filenames as stable API namespaces.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Developer-only grant/revoke entry point. The default only previews the change.
export const setAdmin = internalMutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    expectedOwnerId: v.id("users"),
    grant: v.boolean(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    if (group.ownerId !== args.expectedOwnerId) {
      throw new Error("Group owner changed; verify the target before retrying");
    }
    if (group.ownerId === args.userId) {
      throw new Error(
        "The owner already has access; this script manages admins"
      );
    }

    if (args.grant) {
      if (!(await ctx.db.get(args.userId))) {
        throw new Error("User not found");
      }
      const member = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_userId", (q) =>
          q.eq("groupId", args.groupId).eq("userId", args.userId)
        )
        .first();
      if (!member) {
        throw new Error("The new admin must already be a member");
      }
    }

    const before = group.adminIds ?? [];
    const after = args.grant
      ? [...new Set([...before, args.userId])]
      : before.filter((id) => id !== args.userId);
    const dryRun = args.dryRun ?? true;
    const changed =
      before.length !== after.length ||
      before.some((id, index) => id !== after[index]);
    if (!dryRun && changed) {
      await ctx.db.patch(group._id, { adminIds: after });
    }

    return {
      groupId: group._id,
      groupName: group.name,
      ownerId: group.ownerId,
      userId: args.userId,
      before,
      after,
      dryRun,
      applied: !dryRun && changed,
    };
  },
});
