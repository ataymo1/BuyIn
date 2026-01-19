# Migration Guide: Group-Based System

This guide will help you migrate your existing data to the new group-based system.

## Prerequisites

1. Backup your database before running any migrations
2. Ensure you have the latest code changes
3. Make sure your database connection is working

## Step 1: Update Prisma Schema

The schema has been updated with new models and relationships. You'll need to create a Prisma migration.

**Important**: Since `groupId` and `createdById` are now required fields, you have two options:

### Option A: Two-Step Migration (Recommended)

1. First, make the fields nullable temporarily:
   - In `prisma/schema.prisma`, change:
     - `groupId String` to `groupId String?`
     - `createdById String` to `createdById String?`
     - `status GameStatus` to `status GameStatus?`
     - `createdById String` in Transaction to `createdById String?`

2. Create and apply the migration:
   ```bash
   npx prisma migrate dev --name add_groups_and_relationships
   ```

3. Run the data migration script (see Step 2)

4. Make the fields required again:
   - Change back to required fields in `prisma/schema.prisma`
   - Create another migration:
   ```bash
   npx prisma migrate dev --name make_group_fields_required
   ```

### Option B: Direct Migration with Defaults

If you're starting fresh or don't mind losing existing games, you can:

1. Create the migration directly:
   ```bash
   npx prisma migrate dev --name add_groups_and_relationships
   ```

2. This will fail if you have existing games. You'll need to either:
   - Delete existing games first, OR
   - Manually edit the migration SQL to handle existing data

## Step 2: Run Data Migration Script

After applying the Prisma migration, run the data migration script:

```bash
npx tsx prisma/migrate-existing-data.ts
```

This script will:
- Create a default group for each user
- Migrate existing games to appropriate groups
- Set all existing games to COMPLETED status
- Set createdById on existing games and transactions

## Step 3: Verify Migration

1. Check that all users have at least one group
2. Verify that all games have a groupId
3. Confirm that all transactions have a createdById
4. Test creating a new group and session

## Troubleshooting

### Error: "groupId cannot be null"
- Make sure you ran the data migration script
- Check that all games have been assigned to groups

### Error: "createdById cannot be null"
- The migration script should handle this
- If issues persist, manually update transactions:
  ```sql
  UPDATE "Transaction" 
  SET "createdById" = (
    SELECT "userId" FROM "Player" WHERE "Player"."id" = "Transaction"."playerId"
  )
  WHERE "createdById" IS NULL;
  ```

### Games not showing up
- Verify group membership
- Check that games are assigned to groups the user belongs to

## Post-Migration

After migration:
1. Users should create/join groups
2. Group owners can create new sessions
3. Players can join active sessions and add their own transactions
4. Old games will be marked as COMPLETED
