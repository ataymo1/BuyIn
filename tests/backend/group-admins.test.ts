/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      name: "Owner",
      email: "owner@example.test",
    });
    const admin = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@example.test",
    });
    const member = await ctx.db.insert("users", {
      name: "Member",
      email: "member@example.test",
    });
    const outsider = await ctx.db.insert("users", {
      name: "Outsider",
      email: "outsider@example.test",
    });
    const stale = await ctx.db.insert("users", {
      name: "Removed admin",
      email: "stale@example.test",
    });
    const groupId = await ctx.db.insert("groups", {
      name: "Main group",
      ownerId: owner,
      adminIds: [admin, stale],
    });
    for (const userId of [owner, admin, member]) {
      await ctx.db.insert("groupMembers", {
        groupId,
        userId,
        role: userId === owner ? "OWNER" : "MEMBER",
        joinedAt: Date.now(),
      });
    }
    const otherGroupId = await ctx.db.insert("groups", {
      name: "Other group",
      ownerId: outsider,
      adminIds: [member],
    });
    await ctx.db.insert("groupMembers", {
      groupId: otherGroupId,
      userId: member,
      role: "MEMBER",
      joinedAt: Date.now(),
    });
    return { owner, admin, member, outsider, stale, groupId, otherGroupId };
  });
  const importArgs = (createdById: Id<"users">, sourceId: string) => ({
    groupId: ids.groupId,
    createdById,
    sourceId,
    date: Date.now(),
    handCount: 0,
    players: [
      { sourcePlayerId: "a", displayName: "A", buyIn: 100, cashOut: 120 },
      { sourcePlayerId: "b", displayName: "B", buyIn: 100, cashOut: 80 },
    ],
  });
  return { t, ...ids, importArgs };
}

describe("group permissions", () => {
  test("grants owner/admin access only within the group and keeps ownership distinct", async () => {
    const { t, groupId, otherGroupId, owner, admin, member, outsider, stale } =
      await setup();
    for (const [userId, allowed] of [
      [owner, true],
      [admin, true],
      [member, false],
      [outsider, false],
      [stale, false],
    ] as const) {
      expect(
        await t.query(api.groups.canManageGroup, { groupId, userId })
      ).toBe(allowed);
    }
    expect(
      await t.query(api.groups.canManageGroup, {
        groupId: otherGroupId,
        userId: admin,
      })
    ).toBe(false);
    expect(
      await t.query(api.groups.isGroupOwner, { groupId, userId: admin })
    ).toBe(false);
    expect(
      await t.query(api.groups.isGroupOwner, { groupId, userId: owner })
    ).toBe(true);
    await t.run((ctx) => ctx.db.patch(groupId, { adminIds: undefined }));
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: owner })
    ).toBe(true);
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: admin })
    ).toBe(false);
    await t.run((ctx) => ctx.db.delete(groupId));
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: owner })
    ).toBe(false);
  });

  test("admins can edit groups and members cannot", async () => {
    const { t, groupId, admin, member, owner } = await setup();
    await t.mutation(api.groups.updateGroup, {
      groupId,
      userId: admin,
      name: "Updated",
    });
    await expect(
      t.mutation(api.groups.updateGroup, {
        groupId,
        userId: member,
        name: "Unauthorized",
      })
    ).rejects.toThrow("Only group owners or admins");
    expect(await t.run((ctx) => ctx.db.get(groupId))).toMatchObject({
      name: "Updated",
      ownerId: owner,
    });
  });

  test("removal revokes admin access and rejoining does not restore it", async () => {
    const { t, groupId, owner, admin } = await setup();
    await expect(
      t.mutation(api.groups.removeMember, {
        groupId,
        actorId: admin,
        userId: owner,
      })
    ).rejects.toThrow("owner cannot be removed");
    await expect(
      t.mutation(api.groups.addMember, {
        groupId,
        actorId: admin,
        userId: admin,
        role: "OWNER",
      })
    ).rejects.toThrow("one owner");
    await t.mutation(api.groups.removeMember, {
      groupId,
      actorId: owner,
      userId: admin,
    });
    expect((await t.run((ctx) => ctx.db.get(groupId)))?.adminIds).not.toContain(
      admin
    );
    await t.mutation(api.groups.addMember, {
      groupId,
      actorId: owner,
      userId: admin,
    });
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: admin })
    ).toBe(false);
  });

  test("admin can start seasons while members cannot", async () => {
    const { t, groupId, owner, admin, member } = await setup();
    await t.mutation(api.seasons.ensureGroupSeason, { groupId, userId: owner });
    const seasons = await t.query(api.seasons.getGroupSeasons, { groupId });
    const args = { groupId, expectedCurrentSeasonId: seasons[0]._id };
    await expect(
      t.mutation(api.seasons.startNewSeason, { ...args, userId: member })
    ).rejects.toThrow("Only group owners or admins");
    await t.mutation(api.seasons.startNewSeason, { ...args, userId: admin });
    expect(
      (await t.query(api.seasons.getGroupSeasons, { groupId })).filter(
        (season) => season.isCurrent
      )
    ).toMatchObject([{ number: 2 }]);
  });
});

describe("import and game management", () => {
  test("owner/admin imports auto-approve; members submit pending requests", async () => {
    const { t, owner, admin, member, importArgs } = await setup();
    for (const userId of [owner, admin]) {
      const result = await t.mutation(
        api.poker_now_imports.createSession,
        importArgs(userId, userId)
      );
      expect(result.status).toBe("APPROVED");
    }
    expect(
      (
        await t.mutation(
          api.poker_now_imports.createSession,
          importArgs(member, "pending")
        )
      ).status
    ).toBe("PENDING");
  });

  test("admin can review pending imports and manage the resulting game", async () => {
    const { t, groupId, owner, admin, member, outsider, stale, importArgs } =
      await setup();
    const result = await t.mutation(
      api.poker_now_imports.createSession,
      importArgs(member, "review")
    );
    if (result.status !== "PENDING") {
      throw new Error("Expected pending import");
    }
    for (const userId of [member, outsider, stale]) {
      expect(
        await t.query(api.poker_now_imports.getPendingRequests, {
          groupId,
          userId,
        })
      ).toEqual([]);
      await expect(
        t.mutation(api.poker_now_imports.respondToRequest, {
          requestId: result.requestId,
          userId,
          approve: true,
        })
      ).rejects.toThrow("Only group owners or admins");
    }
    expect(
      await t.query(api.poker_now_imports.getPendingRequests, {
        groupId,
        userId: admin,
      })
    ).toHaveLength(1);
    const gameId = await t.mutation(api.poker_now_imports.respondToRequest, {
      requestId: result.requestId,
      userId: admin,
      approve: true,
    });
    if (!gameId) {
      throw new Error("Expected game");
    }
    for (const userId of [owner, admin, member]) {
      expect(await t.query(api.games.canManageGame, { gameId, userId })).toBe(
        true
      );
    }
    expect(
      await t.query(api.games.canManageGame, { gameId, userId: outsider })
    ).toBe(false);
    expect(
      await t.query(api.games.canManageGame, { gameId, userId: stale })
    ).toBe(false);
    await t.mutation(api.groups.removeMember, {
      groupId,
      actorId: owner,
      userId: member,
    });
    expect(
      await t.query(api.games.canManageGame, { gameId, userId: member })
    ).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(gameId)))?.createdById).toBe(
      member
    );
  });

  test("admin can reject imports without creating games", async () => {
    const { t, admin, member, importArgs } = await setup();
    const result = await t.mutation(
      api.poker_now_imports.createSession,
      importArgs(member, "reject")
    );
    if (result.status !== "PENDING") {
      throw new Error("Expected pending import");
    }
    await t.mutation(api.poker_now_imports.respondToRequest, {
      requestId: result.requestId,
      userId: admin,
      approve: false,
    });
    expect((await t.run((ctx) => ctx.db.get(result.requestId)))?.status).toBe(
      "REJECTED"
    );
    expect(await t.run((ctx) => ctx.db.query("games").collect())).toHaveLength(
      0
    );
  });
});

describe("internal admin seed", () => {
  test("defaults to dry-run, preserves other admins, and grants/revokes idempotently", async () => {
    const { t, groupId, owner, admin, member } = await setup();
    const args = {
      groupId,
      userId: member,
      expectedOwnerId: owner,
      grant: true,
    };
    expect(
      await t.mutation(internal.group_admins.setAdmin, args)
    ).toMatchObject({ dryRun: true, applied: false });
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: member })
    ).toBe(false);
    expect(
      await t.mutation(internal.group_admins.setAdmin, {
        ...args,
        dryRun: false,
      })
    ).toMatchObject({ applied: true });
    expect(
      await t.mutation(internal.group_admins.setAdmin, {
        ...args,
        dryRun: false,
      })
    ).toMatchObject({ applied: false });
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: member })
    ).toBe(true);
    const group = await t.run((ctx) => ctx.db.get(groupId));
    expect(group?.ownerId).toBe(owner);
    expect(group?.adminIds).toContain(admin);
    expect(group?.adminIds?.filter((id) => id === member)).toHaveLength(1);
    expect(
      await t.mutation(internal.group_admins.setAdmin, {
        ...args,
        grant: false,
        dryRun: false,
      })
    ).toMatchObject({ applied: true });
    expect(
      await t.mutation(internal.group_admins.setAdmin, {
        ...args,
        grant: false,
        dryRun: false,
      })
    ).toMatchObject({ applied: false });
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: member })
    ).toBe(false);
    expect(
      await t.query(api.groups.canManageGroup, { groupId, userId: admin })
    ).toBe(true);
  });

  test("rejects wrong owners and invalid targets, but can revoke deleted users", async () => {
    const { t, groupId, otherGroupId, owner, member, outsider, stale } =
      await setup();
    const args = {
      groupId,
      userId: member,
      expectedOwnerId: owner,
      grant: true,
      dryRun: false,
    };
    await expect(
      t.mutation(internal.group_admins.setAdmin, {
        ...args,
        expectedOwnerId: outsider,
      })
    ).rejects.toThrow("owner changed");
    await expect(
      t.mutation(internal.group_admins.setAdmin, { ...args, userId: outsider })
    ).rejects.toThrow("must already be a member");
    await expect(
      t.mutation(internal.group_admins.setAdmin, { ...args, userId: owner })
    ).rejects.toThrow("owner already has access");
    await t.run((ctx) => ctx.db.delete(stale));
    await expect(
      t.mutation(internal.group_admins.setAdmin, { ...args, userId: stale })
    ).rejects.toThrow("User not found");
    await t.mutation(internal.group_admins.setAdmin, {
      ...args,
      userId: stale,
      grant: false,
    });
    expect((await t.run((ctx) => ctx.db.get(groupId)))?.adminIds).not.toContain(
      stale
    );
    await t.run((ctx) => ctx.db.delete(otherGroupId));
    await expect(
      t.mutation(internal.group_admins.setAdmin, {
        ...args,
        groupId: otherGroupId,
      })
    ).rejects.toThrow("Group not found");
  });
});

describe("other group management operations", () => {
  test("admins can review join requests; members cannot", async () => {
    const { t, groupId, admin, member, outsider, stale } = await setup();
    for (const [userId, approve] of [
      [outsider, true],
      [stale, false],
    ] as const) {
      const requestId = await t.run((ctx) =>
        ctx.db.insert("joinRequests", {
          groupId,
          userId,
          status: "PENDING",
          requestedAt: Date.now(),
        })
      );
      expect(
        await t.query(api.groups.getPendingRequests, {
          groupId,
          userId: member,
        })
      ).toEqual([]);
      expect(
        await t.query(api.groups.getPendingRequests, { groupId, userId: admin })
      ).toHaveLength(1);
      const fn = approve ? api.groups.approveRequest : api.groups.rejectRequest;
      await expect(
        t.mutation(fn, { requestId, userId: member })
      ).rejects.toThrow("Only group owners or admins");
      await t.mutation(fn, { requestId, userId: admin });
      expect((await t.run((ctx) => ctx.db.get(requestId)))?.status).toBe(
        approve ? "APPROVED" : "REJECTED"
      );
    }
    expect(
      await t.query(api.groups.isGroupMember, { groupId, userId: outsider })
    ).toBe(true);
  });

  test("admins can approve and reject history claims; members cannot", async () => {
    const { t, groupId, admin, member } = await setup();
    for (const approve of [true, false]) {
      const requestId = await t.run(async (ctx) => {
        const sourcePlayerId = await ctx.db.insert("players", {
          name: "Unclaimed",
        });
        const targetPlayerId = await ctx.db.insert("players", {
          name: "Member",
          userId: member,
        });
        return await ctx.db.insert("playerClaimRequests", {
          groupId,
          sourcePlayerId,
          targetPlayerId,
          claimantUserId: member,
          status: "PENDING",
          requestedAt: Date.now(),
        });
      });
      expect(
        await t.query(api.player_claims.getPendingClaims, {
          groupId,
          userId: member,
        })
      ).toEqual([]);
      expect(
        await t.query(api.player_claims.getPendingClaims, {
          groupId,
          userId: admin,
        })
      ).toHaveLength(1);
      await expect(
        t.mutation(api.player_claims.respondToClaim, {
          requestId,
          userId: member,
          approve,
        })
      ).rejects.toThrow("Only group owners or admins");
      await t.mutation(api.player_claims.respondToClaim, {
        requestId,
        userId: admin,
        approve,
      });
      expect((await t.run((ctx) => ctx.db.get(requestId)))?.status).toBe(
        approve ? "APPROVED" : "REJECTED"
      );
    }
  });

  test("admin group deletion removes related data while other groups survive", async () => {
    const { t, groupId, otherGroupId, owner, admin, member, importArgs } =
      await setup();
    const imported = await t.mutation(
      api.poker_now_imports.createSession,
      importArgs(owner, "delete-test")
    );
    if (imported.status !== "APPROVED") {
      throw new Error("Expected approved import");
    }
    await expect(
      t.mutation(api.groups.deleteGroup, { groupId, userId: member })
    ).rejects.toThrow("Only group owners or admins");
    await t.mutation(api.groups.deleteGroup, { groupId, userId: admin });
    expect(await t.run((ctx) => ctx.db.get(groupId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(otherGroupId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(imported.gameId))).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("transactions").collect())
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("pokerNowSessionPlayers").collect())
    ).toEqual([]);
  });
});
