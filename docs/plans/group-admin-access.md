# Group admin access plan

Status: implemented on September 29, 2026. The production Convex backend is deployed, and Jason's admin grant has been applied and verified. Frontend release is pending.

Validation: 12 backend permission tests and 14 parser tests pass, along with type checking, focused lint, shell syntax validation, and the production build. A production read confirmed Jason and the original owner both pass `canManageGroup`; Jason remains a `MEMBER`. The local frontend loads, but verifying signed-in controls requires a fresh browser login. No real pending submissions were approved during validation.

## Outcome and verified target

Give Jason Kim the same group-management permissions as the current owner of SCE Poker, while retaining the current owner. Admin assignment is maintained through a developer-run script; there is no admin-management UI or public grant endpoint.

Read-only verification against the backend currently used by the local app returned:

| Field | Value |
| --- | --- |
| Deployment | `determined-cricket-426` (production) |
| Group | SCE Poker |
| Group ID | `jn732tfbxd1ewz7swzwfk72jg57zs2pt` |
| Jason's user ID | `k57dj2shasq9p4hhr4s2qje9y57zq2am` |
| Current owner user ID | `k576r55jgfd1dc81kng2smksph7zscd0` |
| Jason's current membership | `MEMBER` |

Jason's ID was verified from `groups:getGroup` membership data. Use this `users` ID, not a player ID or an authentication-provider ID. Revalidate the target before applying the seed. IDs in another development deployment may differ.

## 1. Schema and authorization helper

In `convex/schema.ts`, add an optional field to `groups`:

```ts
adminIds: v.optional(v.array(v.id("users"))),
```

Old groups treat the missing field as an empty list, so no global backfill is necessary. Keep `ownerId` and the existing membership roles unchanged. Jason remains a member, with additional capabilities granted by the group's `adminIds`.

Add `canUserManageGroup(ctx, group, userId)` in `convex/helpers.ts`:

- Return true for `group.ownerId === userId`.
- Otherwise require both `group.adminIds?.includes(userId)` and an existing `groupMembers` record for this user and group.
- Return false for all other users and missing groups.
- Add a throwing wrapper for mutations so backend checks share the same behavior.

This helper checks capabilities, not caller identity. Existing mutations accept caller-supplied `userId`/`actorId` values. Preserve that distinction in implementation and review; adding `adminIds` does not authenticate those values. The grant/revoke function below is internal and must never become a browser-callable mutation.

## 2. Apply owner-equivalent group permissions

Replace authorization comparisons with the shared helper at these existing boundaries:

| Location | Admin capability |
| --- | --- |
| `convex/poker_now_imports.ts` | View pending imports, approve/reject submissions, and create imports immediately without approval |
| `convex/helpers.ts` | Manage games in the group, retaining existing session-creator permissions |
| `convex/groups.ts` | Update/delete the group, add/remove members, and view/approve/reject join requests |
| `convex/seasons.ts` | Perform the currently owner-restricted season operation |
| `convex/player_claims.ts` | View and review player-history claims |

Full parity includes the existing group-delete capability. Ownership itself remains singular: admins cannot remove the owner, create a second `OWNER` membership, or implicitly transfer ownership. Continue using the real `ownerId` for ownership display, indexes, and existing owner attribution; do not mechanically replace every occurrence of `ownerId`.

When removing a member, remove their ID from `adminIds` in the same mutation. This revokes access and prevents a later rejoin from silently restoring admin access. A removed admin also fails the membership check even if stale data temporarily leaves their ID in the array.

## 3. Expose existing controls to admins

Add a `groups:canManageGroup` query that calls the shared helper. Keep `isGroupOwner` as an ownership query rather than changing its meaning to include admins.

Update `src/features/groups/group-detail/index.tsx` and its child props to use `canManageGroup` for existing settings, pending import/join/claim review sections, member-management controls, and season controls. Keep owner badges based on actual ownership. Session controls continue using `games:canManageGame`, which inherits the helper change.

Update relevant error messages from “Only the group owner/leader…” to “Only group owners or admins…”. Do not add an admin editor, grant button, or role-management screen.

## 4. Internal seed/revoke function

After the schema change, implement this in `convex/group_admins.ts`. It follows the repository's existing `internalMutation` migration pattern. The function accepts IDs generically; only the one-time invocation below contains Jason's specific IDs.

```ts
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
    if (!group) throw new Error("Group not found");
    if (group.ownerId !== args.expectedOwnerId) {
      throw new Error("Group owner changed; verify the target before retrying");
    }
    if (group.ownerId === args.userId) {
      throw new Error("The owner already has access; this script manages admins");
    }

    if (args.grant) {
      const user = await ctx.db.get(args.userId);
      if (!user) throw new Error("User not found");
      const member = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_userId", (q) =>
          q.eq("groupId", args.groupId).eq("userId", args.userId)
        )
        .first();
      if (!member) throw new Error("The new admin must already be a member");
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
```

The mutation preserves other admins, deduplicates additions, supports repeat runs, and performs one atomic database update. Revocation can remove a stale ID even when the user or membership no longer exists.

## 5. Seed script for Jason and SCE Poker

The implemented script is `scripts/seed-sce-admin.sh`. Its default is a read-only dry run. Run it from a checkout configured with authorized Convex developer credentials after deploying the schema, helper, permission updates, and internal function.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

case "${CONVEX_DEPLOY_KEY:-}" in
  ""|prod:determined-cricket-426\|*) ;;
  *) echo "Refusing to seed: CONVEX_DEPLOY_KEY targets a different deployment." >&2; exit 2 ;;
esac

case "${1:---dry-run}" in
  --dry-run) dry_run=true; grant=true ;;
  --apply) dry_run=false; grant=true ;;
  --revoke) dry_run=false; grant=false ;;
  *) echo "Usage: $0 [--dry-run|--apply|--revoke]" >&2; exit 2 ;;
esac

args=$(cat <<JSON
{
  "groupId": "jn732tfbxd1ewz7swzwfk72jg57zs2pt",
  "userId": "k57dj2shasq9p4hhr4s2qje9y57zq2am",
  "expectedOwnerId": "k576r55jgfd1dc81kng2smksph7zscd0",
  "grant": $grant,
  "dryRun": $dry_run
}
JSON
)

pnpm exec convex run \
  --deployment-name determined-cricket-426 \
  group_admins:setAdmin "$args"
```

Execute these steps only after implementation and deployment:

```bash
# Inspect the group, owner, target ID, and proposed admin list.
bash scripts/seed-sce-admin.sh --dry-run

# Add Jason without replacing existing admins or the owner.
bash scripts/seed-sce-admin.sh --apply

# Roll back only Jason's additional group-admin grant if needed.
bash scripts/seed-sce-admin.sh --revoke
```

The dry run and apply commands completed successfully on September 29, 2026. The revoke command is available for rollback and has not been run against production. The explicit deployment selector and deploy-key guard keep the script pointed at the intended backend (Convex deploy keys take precedence over the selector). The specific IDs live in the seed script and resulting database record, not in the application's authorization logic.

## 6. Validation and rollout

1. Add backend permission tests for owner, active admin, ordinary member, admin of another group, and stale admin without membership. Cover missing `adminIds` for legacy groups and preserve existing session-creator permissions.
2. Verify pending-import visibility and approve/reject permissions; owner/admin submissions auto-approve, ordinary-member submissions remain pending. Existing pending submissions stay pending until reviewed.
3. Verify all other owner-equivalent operations listed above, including owner-removal protection and admin revocation when a member is removed. Check frontend and backend agree on which controls are available.
4. Test the internal function: default dry run writes nothing; duplicate grants are no-ops; other admins are preserved; bad IDs, nonmembers, and an unexpected owner are rejected; revoke works and can be repeated.
5. Run unit tests, type checking, and lint. Deploy the optional schema and backend changes before the frontend starts querying the new permission function.
6. Deploy the corresponding frontend controls, run the production dry run, then apply the seed to the verified group. Re-read `groups:getGroup` and `groups:canManageGroup` to confirm Jason has access and the original owner is unchanged.
7. Verify Jason sees the existing review controls. Use isolated test data for approval behavior; do not approve real pending submissions merely to test the grant.

Completion: Jason and the existing owner can manage SCE Poker, regular members still require import approval, other groups are unaffected, and no admin-management UI exists.
