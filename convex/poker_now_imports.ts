// biome-ignore-all lint/style/useFilenamingConvention: Convex exposes underscore filenames as stable API namespaces.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireGameManager } from "./helpers";

const importedPlayer = v.object({
  sourcePlayerId: v.string(),
  displayName: v.string(),
  buyIn: v.number(),
  cashOut: v.number(),
  playerId: v.optional(v.id("players")),
});

const assignedImportedPlayer = v.object({
  sourcePlayerId: v.string(),
  displayName: v.string(),
  buyIn: v.number(),
  cashOut: v.number(),
  playerId: v.id("players"),
});

type ImportedPlayer = Doc<"pokerNowImportRequests">["players"][number];
interface ImportData {
  groupId: Id<"groups">;
  createdById: Id<"users">;
  sourceId: string;
  date: number;
  smallBlind?: number;
  bigBlind?: number;
  handCount: number;
  players: ImportedPlayer[];
}

async function findDuplicate(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  sourceId: string
) {
  const game = await ctx.db
    .query("games")
    .withIndex("by_groupId_importSourceId", (q) =>
      q.eq("groupId", groupId).eq("importSourceId", sourceId)
    )
    .first();
  const request = await ctx.db
    .query("pokerNowImportRequests")
    .withIndex("by_groupId_sourceId", (q) =>
      q.eq("groupId", groupId).eq("sourceId", sourceId)
    )
    .filter((q) => q.eq(q.field("status"), "PENDING"))
    .first();
  return game ?? request;
}

function validateImportedPlayer(imported: ImportedPlayer) {
  const displayName = imported.displayName.trim();
  if (!(displayName && displayName.length <= 80)) {
    throw new Error("Player names must be between 1 and 80 characters");
  }
  if (!imported.sourcePlayerId.trim()) {
    throw new Error("Imported players need a source ID");
  }
  if (
    !(
      Number.isFinite(imported.buyIn) &&
      Number.isFinite(imported.cashOut) &&
      imported.buyIn >= 0 &&
      imported.cashOut >= 0
    )
  ) {
    throw new Error("Player totals must be valid non-negative numbers");
  }
  return displayName;
}

async function persistSession(ctx: MutationCtx, args: ImportData) {
  const sourcePlayerIds = args.players.map((player) =>
    player.sourcePlayerId.trim()
  );
  if (new Set(sourcePlayerIds).size !== sourcePlayerIds.length) {
    throw new Error("PokerNow usernames must have unique source IDs");
  }

  const totalsByPlayer = new Map<
    Id<"players">,
    { buyIn: number; cashOut: number }
  >();
  const resolvedPlayers: Array<{
    sourcePlayerId: string;
    displayName: string;
    buyIn: number;
    cashOut: number;
    playerId: Id<"players">;
  }> = [];

  for (const imported of args.players) {
    const displayName = validateImportedPlayer(imported);
    const sourcePlayerId = imported.sourcePlayerId.trim();
    let playerId = imported.playerId;
    if (playerId && !(await ctx.db.get(playerId))) {
      throw new Error("A selected player no longer exists");
    }
    playerId ??= await ctx.db.insert("players", {
      name: displayName,
    });

    const priorAlias = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId_sourcePlayerId", (q) =>
        q.eq("groupId", args.groupId).eq("sourcePlayerId", sourcePlayerId)
      )
      .first();
    if (priorAlias) {
      await ctx.db.patch(priorAlias._id, {
        playerId,
        displayName,
      });
    } else {
      await ctx.db.insert("pokerNowAliases", {
        groupId: args.groupId,
        sourcePlayerId,
        displayName,
        playerId,
      });
    }

    resolvedPlayers.push({
      sourcePlayerId,
      displayName,
      buyIn: imported.buyIn,
      cashOut: imported.cashOut,
      playerId,
    });

    const totals = totalsByPlayer.get(playerId) ?? { buyIn: 0, cashOut: 0 };
    totals.buyIn += imported.buyIn;
    totals.cashOut += imported.cashOut;
    totalsByPlayer.set(playerId, totals);
  }

  if (totalsByPlayer.size < 2) {
    throw new Error("An imported session needs at least two different players");
  }

  const gameId = await ctx.db.insert("games", {
    date: args.date,
    location: "PokerNow",
    notes: `Imported from PokerNow · ${args.handCount} hands${
      args.smallBlind && args.bigBlind
        ? ` · ${args.smallBlind}/${args.bigBlind} blinds`
        : ""
    }`,
    status: "COMPLETED",
    gameType: "cash",
    groupId: args.groupId,
    createdById: args.createdById,
    importSource: "POKER_NOW",
    importSourceId: args.sourceId,
    smallBlind: args.smallBlind,
    bigBlind: args.bigBlind,
  });

  for (const player of resolvedPlayers) {
    await ctx.db.insert("pokerNowSessionPlayers", {
      gameId,
      ...player,
    });
  }

  for (const [playerId, totals] of totalsByPlayer) {
    const buyIn = Math.round(totals.buyIn * 100) / 100;
    const cashOut = Math.round(totals.cashOut * 100) / 100;
    await ctx.db.insert("gamePlayers", {
      gameId,
      playerId,
      buyIn,
      cashOut,
      profit: Math.round((cashOut - buyIn) * 100) / 100,
    });
    for (const transaction of [
      { type: "buyin" as const, amount: buyIn },
      { type: "cashout" as const, amount: cashOut },
    ]) {
      await ctx.db.insert("transactions", {
        gameId,
        playerId,
        ...transaction,
        description: "Imported from PokerNow",
        importSource: "POKER_NOW",
        createdById: args.createdById,
        status: "APPROVED",
      });
    }
  }
  return gameId;
}

const roundCurrency = (amount: number) => Math.round(amount * 100) / 100;

function getApprovedTotal(
  transactions: Doc<"transactions">[],
  type: "buyin" | "cashout"
) {
  return roundCurrency(
    transactions
      .filter(
        (transaction) =>
          transaction.type === type &&
          (transaction.status === "APPROVED" ||
            transaction.status === undefined)
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  );
}

async function syncGamePlayerRows(
  ctx: MutationCtx,
  gameId: Id<"games">,
  sessionPlayers: Doc<"pokerNowSessionPlayers">[],
  previousMappedPlayerIds: Set<Id<"players">>
) {
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .collect();
  const gamePlayers = await ctx.db
    .query("gamePlayers")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .collect();
  const playerIds = new Set<Id<"players">>([
    ...gamePlayers.map((row) => row.playerId),
    ...transactions.map((transaction) => transaction.playerId),
    ...sessionPlayers.map((player) => player.playerId),
  ]);

  for (const playerId of playerIds) {
    const playerTransactions = transactions.filter(
      (transaction) => transaction.playerId === playerId
    );
    const buyIn = getApprovedTotal(playerTransactions, "buyin");
    const cashOut = getApprovedTotal(playerTransactions, "cashout");
    const rows = gamePlayers.filter((row) => row.playerId === playerId);
    const isMapped = sessionPlayers.some(
      (sessionPlayer) => sessionPlayer.playerId === playerId
    );

    if (
      previousMappedPlayerIds.has(playerId) &&
      !(isMapped || playerTransactions.length > 0)
    ) {
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      continue;
    }

    const retained = rows[0];
    if (retained) {
      await ctx.db.patch(retained._id, {
        buyIn,
        cashOut,
        profit: roundCurrency(cashOut - buyIn),
      });
      for (const duplicate of rows.slice(1)) {
        await ctx.db.delete(duplicate._id);
      }
    } else {
      await ctx.db.insert("gamePlayers", {
        gameId,
        playerId,
        buyIn,
        cashOut,
        profit: roundCurrency(cashOut - buyIn),
      });
    }
  }
}

function getAliasTotals(
  players: ImportedPlayer[],
  aliases: Doc<"pokerNowAliases">[]
) {
  const totals = new Map<Id<"players">, { buyIn: number; cashOut: number }>();
  for (const player of players) {
    const sourcePlayerId = player.sourcePlayerId.trim();
    const alias = aliases.find(
      (candidate) => candidate.sourcePlayerId === sourcePlayerId
    );
    if (!alias) {
      return null;
    }
    const playerTotals = totals.get(alias.playerId) ?? {
      buyIn: 0,
      cashOut: 0,
    };
    playerTotals.buyIn += player.buyIn;
    playerTotals.cashOut += player.cashOut;
    totals.set(alias.playerId, playerTotals);
  }
  return totals;
}

function getImportedTotals(sessionPlayers: Doc<"pokerNowSessionPlayers">[]) {
  const totals = new Map<Id<"players">, { buyIn: number; cashOut: number }>();
  for (const sessionPlayer of sessionPlayers) {
    const playerTotals = totals.get(sessionPlayer.playerId) ?? {
      buyIn: 0,
      cashOut: 0,
    };
    playerTotals.buyIn += sessionPlayer.buyIn;
    playerTotals.cashOut += sessionPlayer.cashOut;
    totals.set(sessionPlayer.playerId, playerTotals);
  }
  return totals;
}

function allocateSourceTotals(
  sourcePlayers: Doc<"pokerNowSessionPlayers">[],
  type: "buyin" | "cashout",
  currentTotal: number
) {
  const sourceAmountsInCents = sourcePlayers.map((player) =>
    Math.round((type === "buyin" ? player.buyIn : player.cashOut) * 100)
  );
  const sourceTotalInCents = sourceAmountsInCents.reduce(
    (sum, amount) => sum + amount,
    0
  );
  const currentTotalInCents = Math.max(0, Math.round(currentTotal * 100));
  let remainingInCents = currentTotalInCents;

  return sourcePlayers.map((sourcePlayer, index) => {
    const proportionalAmount =
      sourceTotalInCents > 0
        ? Math.round(
            (currentTotalInCents * (sourceAmountsInCents[index] ?? 0)) /
              sourceTotalInCents
          )
        : Math.round(currentTotalInCents / sourcePlayers.length);
    const amountInCents =
      index === sourcePlayers.length - 1
        ? remainingInCents
        : Math.min(remainingInCents, Math.max(0, proportionalAmount));
    remainingInCents -= amountInCents;
    return { sourcePlayer, amount: amountInCents / 100 };
  });
}

function redistributeImportedTotals(
  transactions: Doc<"transactions">[],
  previousPlayers: Doc<"pokerNowSessionPlayers">[],
  updatedPlayers: Doc<"pokerNowSessionPlayers">[]
) {
  const totals = new Map<Id<"players">, { buyIn: number; cashOut: number }>();
  const updatedBySourceId = new Map(
    updatedPlayers.map((player) => [player.sourcePlayerId, player])
  );
  const previousPlayerIds = new Set(
    previousPlayers.map((player) => player.playerId)
  );

  for (const previousPlayerId of previousPlayerIds) {
    const sourcePlayers = previousPlayers.filter(
      (player) => player.playerId === previousPlayerId
    );
    for (const type of ["buyin", "cashout"] as const) {
      const currentTotal = roundCurrency(
        transactions
          .filter(
            (transaction) =>
              transaction.playerId === previousPlayerId &&
              transaction.type === type
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0)
      );
      const allocations = allocateSourceTotals(
        sourcePlayers,
        type,
        currentTotal
      );

      for (const { sourcePlayer, amount } of allocations) {
        const updatedPlayer = updatedBySourceId.get(
          sourcePlayer.sourcePlayerId
        );
        if (!updatedPlayer) {
          throw new Error("A PokerNow username assignment is missing");
        }
        const targetTotals = totals.get(updatedPlayer.playerId) ?? {
          buyIn: 0,
          cashOut: 0,
        };
        if (type === "buyin") {
          targetTotals.buyIn += amount;
        } else {
          targetTotals.cashOut += amount;
        }
        totals.set(updatedPlayer.playerId, targetTotals);
      }
    }
  }

  return totals;
}

async function rebuildImportedSession(
  ctx: MutationCtx,
  game: Doc<"games">,
  sessionPlayers: Doc<"pokerNowSessionPlayers">[],
  previousMappedPlayerIds: Set<Id<"players">>,
  removeLegacyTransactions = false,
  previousSessionPlayers?: Doc<"pokerNowSessionPlayers">[]
) {
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
    .collect();

  for (const transaction of transactions) {
    if (
      transaction.importSource === "POKER_NOW" ||
      (removeLegacyTransactions &&
        transaction.description === "Imported from PokerNow")
    ) {
      await ctx.db.delete(transaction._id);
    }
  }

  const importedTransactions = transactions.filter(
    (transaction) => transaction.importSource === "POKER_NOW"
  );
  const importedTotals = previousSessionPlayers
    ? redistributeImportedTotals(
        importedTransactions,
        previousSessionPlayers,
        sessionPlayers
      )
    : getImportedTotals(sessionPlayers);

  for (const [playerId, totals] of importedTotals) {
    for (const transaction of [
      { type: "buyin" as const, amount: roundCurrency(totals.buyIn) },
      { type: "cashout" as const, amount: roundCurrency(totals.cashOut) },
    ]) {
      await ctx.db.insert("transactions", {
        gameId: game._id,
        playerId,
        ...transaction,
        description: "Imported from PokerNow",
        importSource: "POKER_NOW",
        createdById: game.createdById,
        status: "APPROVED",
      });
    }
  }

  await syncGamePlayerRows(
    ctx,
    game._id,
    sessionPlayers,
    previousMappedPlayerIds
  );
}

async function requireGroupMemberPlayers(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  playerIds: Set<Id<"players">>
) {
  for (const playerId of playerIds) {
    const player = await ctx.db.get(playerId);
    if (!player?.userId) {
      throw new Error(
        "PokerNow usernames can only be assigned to group members"
      );
    }
    const memberUserId = player.userId;
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", groupId).eq("userId", memberUserId)
      )
      .first();
    if (!membership) {
      throw new Error("A selected player is no longer a group member");
    }
  }
}

async function requireRestorationPlayers(
  ctx: MutationCtx,
  game: Doc<"games">,
  playerIds: Set<Id<"players">>
) {
  const gamePlayers = await ctx.db
    .query("gamePlayers")
    .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
    .collect();
  const existingPlayerIds = new Set(
    gamePlayers.map((gamePlayer) => gamePlayer.playerId)
  );

  for (const playerId of playerIds) {
    const player = await ctx.db.get(playerId);
    if (!player) {
      throw new Error("A selected player no longer exists");
    }
    if (!player.userId) {
      if (!existingPlayerIds.has(playerId)) {
        throw new Error("An unclaimed player is not part of this session");
      }
      continue;
    }
    await requireGroupMemberPlayers(ctx, game.groupId, new Set([playerId]));
  }
}

export const getSessionMappings = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.importSource !== "POKER_NOW") {
      return [];
    }

    const mappings = await ctx.db
      .query("pokerNowSessionPlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect();

    return mappings.sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    );
  },
});

export const updateSessionMappings = mutation({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
    mappings: v.array(
      v.object({
        sourcePlayerId: v.string(),
        currentPlayerId: v.id("players"),
        playerId: v.id("players"),
      })
    ),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Session not found");
    }
    if (game.importSource !== "POKER_NOW") {
      throw new Error("Only PokerNow sessions have username assignments");
    }
    await requireGameManager(
      ctx,
      game,
      args.userId,
      "Only the group owner or session banker can edit username assignments"
    );

    const sessionPlayers = await ctx.db
      .query("pokerNowSessionPlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    if (sessionPlayers.length === 0) {
      throw new Error(
        "Username details are unavailable for this older import. Re-import the PokerNow log to create an editable session."
      );
    }

    const updates = new Map(
      args.mappings.map((mapping) => [mapping.sourcePlayerId, mapping])
    );
    if (
      updates.size !== sessionPlayers.length ||
      sessionPlayers.some((player) => !updates.has(player.sourcePlayerId))
    ) {
      throw new Error("Every PokerNow username needs an assignment");
    }
    if (
      sessionPlayers.some(
        (player) =>
          updates.get(player.sourcePlayerId)?.currentPlayerId !==
          player.playerId
      )
    ) {
      throw new Error(
        "Username assignments changed while you were editing. Reopen the editor and try again."
      );
    }

    const targetPlayerIds = new Set(
      [...updates.values()].map((mapping) => mapping.playerId)
    );
    if (targetPlayerIds.size < 2) {
      throw new Error("A session needs at least two different players");
    }

    const changedTargetPlayerIds = new Set(
      [...updates.values()]
        .filter((mapping) => mapping.playerId !== mapping.currentPlayerId)
        .map((mapping) => mapping.playerId)
    );
    await requireGroupMemberPlayers(ctx, game.groupId, changedTargetPlayerIds);

    for (const sessionPlayer of sessionPlayers) {
      const playerId = updates.get(sessionPlayer.sourcePlayerId)?.playerId;
      if (!playerId) {
        throw new Error("Every PokerNow username needs an assignment");
      }
      await ctx.db.patch(sessionPlayer._id, { playerId });

      const alias = await ctx.db
        .query("pokerNowAliases")
        .withIndex("by_groupId_sourcePlayerId", (q) =>
          q
            .eq("groupId", game.groupId)
            .eq("sourcePlayerId", sessionPlayer.sourcePlayerId)
        )
        .first();
      if (alias) {
        await ctx.db.patch(alias._id, {
          displayName: sessionPlayer.displayName,
          playerId,
        });
      } else {
        await ctx.db.insert("pokerNowAliases", {
          groupId: game.groupId,
          sourcePlayerId: sessionPlayer.sourcePlayerId,
          displayName: sessionPlayer.displayName,
          playerId,
        });
      }
    }

    const updatedSessionPlayers = await ctx.db
      .query("pokerNowSessionPlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    await rebuildImportedSession(
      ctx,
      game,
      updatedSessionPlayers,
      new Set(sessionPlayers.map((player) => player.playerId)),
      false,
      sessionPlayers
    );
  },
});

export const restoreSessionMappings = mutation({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
    sourceId: v.string(),
    players: v.array(assignedImportedPlayer),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Session not found");
    }
    if (
      game.importSource !== "POKER_NOW" ||
      game.importSourceId !== args.sourceId
    ) {
      throw new Error("Upload the original PokerNow log for this session");
    }
    await requireGameManager(
      ctx,
      game,
      args.userId,
      "Only the group owner or session banker can restore username assignments"
    );

    const existingMappings = await ctx.db
      .query("pokerNowSessionPlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    if (existingMappings.length > 0) {
      throw new Error("Username assignments have already been restored");
    }

    const sourcePlayerIds = args.players.map((player) =>
      player.sourcePlayerId.trim()
    );
    if (
      sourcePlayerIds.length < 2 ||
      new Set(sourcePlayerIds).size !== sourcePlayerIds.length
    ) {
      throw new Error("Include at least two unique PokerNow usernames");
    }
    const targetPlayerIds = new Set(
      args.players.map((player) => player.playerId)
    );
    if (targetPlayerIds.size < 2) {
      throw new Error("A session needs at least two different players");
    }
    await requireRestorationPlayers(ctx, game, targetPlayerIds);

    const allTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    const legacyTransactions = allTransactions.filter(
      (transaction) => transaction.description === "Imported from PokerNow"
    );
    const gamePlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    const aliases = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId", (q) => q.eq("groupId", game.groupId))
      .collect();
    const aliasTotals = getAliasTotals(args.players, aliases);
    const matchesAliasTotals =
      aliasTotals?.size === gamePlayers.length &&
      gamePlayers.every((gamePlayer) => {
        const totals = aliasTotals.get(gamePlayer.playerId);
        return (
          totals !== undefined &&
          roundCurrency(totals.buyIn) === roundCurrency(gamePlayer.buyIn) &&
          roundCurrency(totals.cashOut) ===
            roundCurrency(gamePlayer.cashOut ?? 0)
        );
      });
    const hasPristineLegacyTransactions =
      allTransactions.length === gamePlayers.length * 2 &&
      legacyTransactions.length === allTransactions.length &&
      gamePlayers.every((gamePlayer) =>
        (["buyin", "cashout"] as const).every((type) => {
          const matches = legacyTransactions.filter(
            (transaction) =>
              transaction.playerId === gamePlayer.playerId &&
              transaction.type === type
          );
          const expectedAmount =
            type === "buyin" ? gamePlayer.buyIn : (gamePlayer.cashOut ?? 0);
          return (
            matches.length === 1 &&
            roundCurrency(matches[0]?.amount ?? 0) ===
              roundCurrency(expectedAmount)
          );
        })
      );
    const restoredBuyIn = roundCurrency(
      args.players.reduce((sum, player) => sum + player.buyIn, 0)
    );
    const restoredCashOut = roundCurrency(
      args.players.reduce((sum, player) => sum + player.cashOut, 0)
    );
    const legacyBuyIn = roundCurrency(
      legacyTransactions
        .filter((transaction) => transaction.type === "buyin")
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    );
    const legacyCashOut = roundCurrency(
      legacyTransactions
        .filter((transaction) => transaction.type === "cashout")
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    );
    if (
      !(hasPristineLegacyTransactions && matchesAliasTotals) ||
      restoredBuyIn !== legacyBuyIn ||
      restoredCashOut !== legacyCashOut
    ) {
      throw new Error(
        "This older session has edited transactions or different included players, so its assignments cannot be restored safely."
      );
    }

    for (const imported of args.players) {
      const displayName = validateImportedPlayer(imported);
      const sourcePlayerId = imported.sourcePlayerId.trim();
      await ctx.db.insert("pokerNowSessionPlayers", {
        gameId: args.gameId,
        sourcePlayerId,
        displayName,
        buyIn: imported.buyIn,
        cashOut: imported.cashOut,
        playerId: imported.playerId,
      });

      const alias = await ctx.db
        .query("pokerNowAliases")
        .withIndex("by_groupId_sourcePlayerId", (q) =>
          q.eq("groupId", game.groupId).eq("sourcePlayerId", sourcePlayerId)
        )
        .first();
      if (alias) {
        await ctx.db.patch(alias._id, {
          displayName,
          playerId: imported.playerId,
        });
      } else {
        await ctx.db.insert("pokerNowAliases", {
          groupId: game.groupId,
          sourcePlayerId,
          displayName,
          playerId: imported.playerId,
        });
      }
    }

    const restoredMappings = await ctx.db
      .query("pokerNowSessionPlayers")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .collect();
    await rebuildImportedSession(
      ctx,
      game,
      restoredMappings,
      new Set(legacyTransactions.map((transaction) => transaction.playerId)),
      true
    );
  },
});

export const getCandidates = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    const memberPlayers = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        const player = await ctx.db
          .query("players")
          .withIndex("by_userId", (q) => q.eq("userId", member.userId))
          .first();
        return player
          ? { id: player._id, name: player.name, email: user?.email }
          : null;
      })
    );
    const games = await ctx.db
      .query("games")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    const gamePlayers = (
      await Promise.all(
        games.map((game) =>
          ctx.db
            .query("gamePlayers")
            .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
            .collect()
        )
      )
    ).flat();
    const memberPlayerIds = new Set(
      memberPlayers.flatMap((player) => (player ? [player.id] : []))
    );
    const historicalPlayerIds = [
      ...new Set(gamePlayers.map((gamePlayer) => gamePlayer.playerId)),
    ].filter((playerId) => !memberPlayerIds.has(playerId));
    const historicalPlayers = await Promise.all(
      historicalPlayerIds.map(async (playerId) => {
        const player = await ctx.db.get(playerId);
        return player && !player.userId
          ? { id: player._id, name: player.name, isExtra: true as const }
          : null;
      })
    );
    const aliases = await ctx.db
      .query("pokerNowAliases")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    const players = [
      ...memberPlayers
        .filter((player) => player !== null)
        .map((player) => ({ ...player, isExtra: false as const })),
      ...historicalPlayers.filter((player) => player !== null),
    ].sort((a, b) => a.name.localeCompare(b.name));
    return { players, aliases };
  },
});

export const getPendingRequests = query({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (group?.ownerId !== args.userId) {
      return [];
    }
    const requests = await ctx.db
      .query("pokerNowImportRequests")
      .withIndex("by_groupId_status", (q) =>
        q.eq("groupId", args.groupId).eq("status", "PENDING")
      )
      .collect();
    return await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requestedById);
        return {
          ...request,
          requesterName: requester?.name ?? requester?.email ?? "Group member",
        };
      })
    );
  },
});

export const createSession = mutation({
  args: {
    groupId: v.id("groups"),
    createdById: v.id("users"),
    sourceId: v.string(),
    date: v.number(),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    handCount: v.number(),
    players: v.array(importedPlayer),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.createdById)
      )
      .first();
    if (!membership) {
      throw new Error("Only group members can import sessions");
    }
    if (await findDuplicate(ctx, args.groupId, args.sourceId)) {
      throw new Error(
        "This PokerNow log has already been imported or is awaiting approval"
      );
    }
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    if (group.ownerId === args.createdById) {
      const gameId = await persistSession(ctx, args);
      return { status: "APPROVED" as const, gameId };
    }
    const requestId = await ctx.db.insert("pokerNowImportRequests", {
      groupId: args.groupId,
      requestedById: args.createdById,
      sourceId: args.sourceId,
      date: args.date,
      smallBlind: args.smallBlind,
      bigBlind: args.bigBlind,
      handCount: args.handCount,
      players: args.players,
      status: "PENDING",
      requestedAt: Date.now(),
    });
    return { status: "PENDING" as const, requestId };
  },
});

export const respondToRequest = mutation({
  args: {
    requestId: v.id("pokerNowImportRequests"),
    userId: v.id("users"),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "PENDING") {
      throw new Error("Import request not found");
    }
    const group = await ctx.db.get(request.groupId);
    if (group?.ownerId !== args.userId) {
      throw new Error("Only the group leader can review imports");
    }
    if (!args.approve) {
      await ctx.db.patch(request._id, {
        status: "REJECTED",
        respondedAt: Date.now(),
        respondedById: args.userId,
      });
      return null;
    }
    if (await findDuplicate(ctx, request.groupId, request.sourceId)) {
      const existingGame = await ctx.db
        .query("games")
        .withIndex("by_groupId_importSourceId", (q) =>
          q
            .eq("groupId", request.groupId)
            .eq("importSourceId", request.sourceId)
        )
        .first();
      if (existingGame) {
        throw new Error("This PokerNow log has already been imported");
      }
    }
    const gameId = await persistSession(ctx, {
      groupId: request.groupId,
      createdById: request.requestedById,
      sourceId: request.sourceId,
      date: request.date,
      smallBlind: request.smallBlind,
      bigBlind: request.bigBlind,
      handCount: request.handCount,
      players: request.players,
    });
    await ctx.db.patch(request._id, {
      status: "APPROVED",
      respondedAt: Date.now(),
      respondedById: args.userId,
      gameId,
    });
    return gameId;
  },
});
