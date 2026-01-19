"use client";

import { useMutation, useQuery } from "convex/react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Hook to get the current user's Convex ID
// Auto-creates user in Convex if they have a valid NextAuth session but don't exist yet
export function useConvexUser() {
  const { data: session, status } = useSession();
  const email = session?.user?.email;
  const name = session?.user?.name;
  const image = session?.user?.image;

  const user = useQuery(api.auth.getUserByEmail, email ? { email } : "skip");
  const createUser = useMutation(api.auth.createUser);

  // Track if we're currently creating a user to prevent duplicate calls
  const isCreatingRef = useRef(false);
  const hasCreatedRef = useRef<string | null>(null);

  // Auto-create user in Convex if they have a session but no Convex user
  useEffect(() => {
    async function syncUser() {
      // Only proceed if:
      // 1. Session is authenticated
      // 2. We have an email
      // 3. User query has completed (user is null, not undefined)
      // 4. We're not already creating
      // 5. We haven't already created this user
      if (
        status === "authenticated" &&
        email &&
        user === null &&
        !isCreatingRef.current &&
        hasCreatedRef.current !== email
      ) {
        isCreatingRef.current = true;
        try {
          console.log("[useConvexUser] Creating user in Convex:", email);
          await createUser({
            email,
            name: name ?? undefined,
            image: image ?? undefined,
          });
          hasCreatedRef.current = email;
          console.log("[useConvexUser] User created successfully");
        } catch (error) {
          console.error("[useConvexUser] Failed to create user:", error);
        } finally {
          isCreatingRef.current = false;
        }
      }
    }
    syncUser();
  }, [status, email, name, image, user, createUser]);

  return {
    user,
    userId: user?._id as Id<"users"> | undefined,
    isLoading:
      (user === undefined && email !== undefined) ||
      (status === "authenticated" && email && user === null),
    session,
  };
}

// Hook to get user's groups
export function useUserGroups() {
  const { userId } = useConvexUser();

  const groups = useQuery(
    api.groups.getUserGroups,
    userId ? { userId } : "skip"
  );

  // Memoize groupIds to prevent new array reference on every render
  const groupIds = useMemo(() => {
    return (groups ?? []).map((g) => g?._id).filter(Boolean) as Id<"groups">[];
  }, [groups]);

  return {
    groups: groups ?? [],
    isLoading: groups === undefined && userId !== undefined,
    groupIds,
  };
}

// Hook to get user's stats
export function useUserStats() {
  const { userId } = useConvexUser();
  const { groupIds, isLoading: groupsLoading } = useUserGroups();

  const shouldSkip = !userId || groupIds.length === 0;

  const stats = useQuery(
    api.stats.getUserStats,
    shouldSkip || !userId ? "skip" : { userId, groupIds }
  );

  return {
    stats: stats ?? {
      totalBuyIns: 0,
      totalCashOuts: 0,
      netProfit: 0,
      gamesPlayed: 0,
    },
    isLoading:
      groupsLoading ||
      (stats === undefined && !shouldSkip && userId !== undefined),
  };
}

// Hook to get a single group
export function useGroup(groupId: Id<"groups"> | undefined) {
  const group = useQuery(api.groups.getGroup, groupId ? { groupId } : "skip");

  return {
    group,
    isLoading: group === undefined && groupId !== undefined,
  };
}

// Hook to get games
export function useGames(options?: {
  groupId?: Id<"groups">;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
}) {
  const { groupIds, isLoading: groupsLoading } = useUserGroups();

  const shouldSkip = groupIds.length === 0;

  const games = useQuery(
    api.games.getGames,
    shouldSkip
      ? "skip"
      : {
          groupIds,
          groupId: options?.groupId,
          status: options?.status,
        }
  );

  return {
    games: games ?? [],
    isLoading: groupsLoading || (games === undefined && !shouldSkip),
  };
}

// Hook to get a single game
export function useGame(gameId: Id<"games"> | undefined) {
  const game = useQuery(api.games.getGame, gameId ? { gameId } : "skip");

  return {
    game,
    isLoading: game === undefined && gameId !== undefined,
  };
}

// Hook to get user's player record
// Auto-creates player in Convex if user exists but player doesn't
export function usePlayer() {
  const { userId, user } = useConvexUser();

  const player = useQuery(
    api.players.getPlayerByUserId,
    userId ? { userId } : "skip"
  );

  const getOrCreatePlayer = useMutation(api.players.getOrCreatePlayerForUser);

  // Track if we're currently creating a player to prevent duplicate calls
  const isCreatingRef = useRef(false);
  const hasCreatedRef = useRef<string | null>(null);

  // Auto-create player if user exists but player doesn't
  useEffect(() => {
    async function syncPlayer() {
      // Only proceed if:
      // 1. We have a userId
      // 2. User record exists (for getting the name)
      // 3. Player query has completed (player is null, not undefined)
      // 4. We're not already creating
      // 5. We haven't already created for this user
      if (
        userId &&
        user &&
        player === null &&
        !isCreatingRef.current &&
        hasCreatedRef.current !== userId
      ) {
        isCreatingRef.current = true;
        try {
          console.log(
            "[usePlayer] Creating player in Convex for user:",
            userId
          );
          await getOrCreatePlayer({
            userId,
            name: user.name || user.email || "Player",
          });
          hasCreatedRef.current = userId;
          console.log("[usePlayer] Player created successfully");
        } catch (error) {
          console.error("[usePlayer] Failed to create player:", error);
        } finally {
          isCreatingRef.current = false;
        }
      }
    }
    syncPlayer();
  }, [userId, user, player, getOrCreatePlayer]);

  return {
    player,
    playerId: player?._id as Id<"players"> | undefined,
    isLoading:
      (player === undefined && userId !== undefined) ||
      (userId && user && player === null),
  };
}

// Mutation hooks
export function useCreateGroup() {
  return useMutation(api.groups.createGroup);
}

export function useCreateGame() {
  return useMutation(api.games.createGame);
}

export function useUpdateGameStatus() {
  return useMutation(api.games.updateGameStatus);
}

export function useJoinGame() {
  return useMutation(api.games.joinGame);
}

export function useCreateTransaction() {
  return useMutation(api.transactions.createTransaction);
}

export function useCreatePlayer() {
  return useMutation(api.players.createPlayer);
}

export function useGetOrCreatePlayer() {
  return useMutation(api.players.getOrCreatePlayerForUser);
}

export function useUpdateGame() {
  return useMutation(api.games.updateGame);
}

export function useDeleteGame() {
  return useMutation(api.games.deleteGame);
}

// Search groups hook
export function useSearchGroups(searchTerm: string) {
  const { userId } = useConvexUser();

  const groups = useQuery(
    api.groups.searchGroups,
    userId && searchTerm.trim() ? { searchTerm, userId } : "skip"
  );

  return {
    groups: groups ?? [],
    isLoading:
      groups === undefined && userId !== undefined && searchTerm.trim() !== "",
  };
}

// Join request hooks
export function useRequestToJoin() {
  return useMutation(api.groups.requestToJoin);
}

export function usePendingRequests(groupId: Id<"groups"> | undefined) {
  const { userId } = useConvexUser();

  const requests = useQuery(
    api.groups.getPendingRequests,
    groupId && userId ? { groupId, userId } : "skip"
  );

  return {
    requests: requests ?? [],
    isLoading:
      requests === undefined && groupId !== undefined && userId !== undefined,
  };
}

export function useApproveRequest() {
  return useMutation(api.groups.approveRequest);
}

export function useRejectRequest() {
  return useMutation(api.groups.rejectRequest);
}

export function useUserPendingRequests() {
  const { userId } = useConvexUser();

  const requests = useQuery(
    api.groups.getUserPendingRequests,
    userId ? { userId } : "skip"
  );

  return {
    requests: requests ?? [],
    isLoading: requests === undefined && userId !== undefined,
  };
}

export function useCancelJoinRequest() {
  return useMutation(api.groups.cancelJoinRequest);
}
