"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConvexUser } from "@/lib/convex-hooks";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  ActiveSessionsSection,
  GroupHeader,
  GroupSettingsSection,
  GroupStandingsSection,
  PendingImportRequestsSection,
  PendingJoinRequestsSection,
  RecentSessionsSection,
  SeasonNavigationSection,
} from "./group-detail-sections";
import { GroupDetailSkeleton } from "./group-detail-skeleton";
import {
  ClaimPlayerHistorySection,
  PendingPlayerClaimsSection,
} from "./player-claim-sections";

interface GroupDetailClientProps {
  groupId: string;
}

interface SeasonSelection {
  _id: Id<"seasons">;
  isCurrent: boolean;
}

function getSelectedSeasonId(
  seasons: SeasonSelection[] | undefined,
  requestedSeason: string | null
) {
  if (!seasons || seasons.length === 0) {
    return undefined;
  }
  if (requestedSeason === "all") {
    return null;
  }
  const requested = seasons.find((season) => season._id === requestedSeason);
  const current = seasons.find((season) => season.isCurrent);
  return requested?._id ?? current?._id ?? seasons[0]?._id;
}

function GroupManagementSections({
  children,
  currentDescription,
  currentName,
  groupId,
  isOwner,
  userId,
}: {
  children: ReactNode;
  currentDescription?: string;
  currentName: string;
  groupId: Id<"groups">;
  isOwner: boolean;
  userId?: Id<"users">;
}) {
  return (
    <>
      {userId ? (
        <ClaimPlayerHistorySection groupId={groupId} userId={userId} />
      ) : null}

      {isOwner && userId ? (
        <>
          <PendingPlayerClaimsSection groupId={groupId} userId={userId} />
          <PendingImportRequestsSection groupId={groupId} userId={userId} />
          <PendingJoinRequestsSection groupId={groupId} />
        </>
      ) : null}

      {children}

      {isOwner ? (
        <GroupSettingsSection
          currentDescription={currentDescription}
          currentName={currentName}
          groupId={groupId}
          groupName={currentName}
        />
      ) : null}
    </>
  );
}

function useSeasonSetup(
  groupId: Id<"groups">,
  userId: Id<"users"> | undefined,
  groupExists: boolean
) {
  const ensureGroupSeason = useMutation(api.seasons.ensureGroupSeason);
  const seasonSetupRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!(userId && groupExists)) {
      return;
    }
    const setupUserId = userId;
    const setupKey = `${groupId}:${setupUserId}:${attempt}`;
    if (seasonSetupRef.current === setupKey) {
      return;
    }
    seasonSetupRef.current = setupKey;
    setError(null);
    let cancelled = false;

    async function setupSeasons() {
      let hasMore = true;
      while (hasMore && !cancelled) {
        const result = await ensureGroupSeason({
          groupId,
          userId: setupUserId,
        });
        hasMore = result.hasMore;
      }
    }

    setupSeasons().catch((error) => {
      if (!cancelled) {
        seasonSetupRef.current = null;
        setError(
          error instanceof Error ? error.message : "Could not set up seasons"
        );
        console.error("Failed to set up group seasons:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, ensureGroupSeason, groupExists, groupId, userId]);

  return {
    error,
    retry: () => {
      seasonSetupRef.current = null;
      setAttempt((value) => value + 1);
    },
  };
}

export function GroupDetailClient({ groupId }: GroupDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typedGroupId = groupId as Id<"groups">;
  const { userId, isLoading: userLoading } = useConvexUser();

  const group = useQuery(api.groups.getGroup, {
    groupId: typedGroupId,
  });

  const isOwner = useQuery(
    api.groups.isGroupOwner,
    userId ? { groupId: typedGroupId, userId } : "skip"
  );
  const seasons = useQuery(api.seasons.getGroupSeasons, {
    groupId: typedGroupId,
  });
  const seasonSetup = useSeasonSetup(typedGroupId, userId, Boolean(group));

  const requestedSeason = searchParams.get("season");
  const selectedSeasonId = getSelectedSeasonId(seasons, requestedSeason);

  const standings = useQuery(
    api.groups.getGroupStandings,
    selectedSeasonId === undefined
      ? "skip"
      : {
          groupId: typedGroupId,
          seasonId: selectedSeasonId ?? undefined,
        }
  );

  const games = useQuery(
    api.games.getGames,
    selectedSeasonId === undefined
      ? "skip"
      : {
          groupIds: [typedGroupId],
          groupId: typedGroupId,
          seasonId: selectedSeasonId ?? undefined,
        }
  );

  const seasonsReady = seasons !== undefined && seasons.length > 0;
  const seasonDataLoading =
    selectedSeasonId !== undefined &&
    (standings === undefined || games === undefined);
  const isLoading =
    userLoading ||
    group === undefined ||
    (Boolean(group) && !seasonsReady && !seasonSetup.error) ||
    seasonDataLoading;

  if (isLoading) {
    return <GroupDetailSkeleton />;
  }

  if (!group) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Group not found</p>
        <Link href="/groups">
          <Button className="mt-4" variant="outline">
            Back to Groups
          </Button>
        </Link>
      </div>
    );
  }

  if (seasonSetup.error && !seasonsReady) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">Could not load this group's seasons</p>
        <p className="mt-1 text-muted-foreground text-sm">
          {seasonSetup.error}
        </p>
        <Button className="mt-4" onClick={seasonSetup.retry} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  const activeGames = (games ?? []).filter((g) => g.status === "ACTIVE");
  const completedGames = (games ?? []).filter((g) => g.status === "COMPLETED");

  const updateSeasonParam = (seasonId: Id<"seasons"> | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", seasonId);
    router.replace(`/groups/${groupId}?${params.toString()}`);
  };

  const showCurrentSeason = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("season");
    const query = params.toString();
    router.replace(`/groups/${groupId}${query ? `?${query}` : ""}`);
  };

  return (
    <div className="space-y-8">
      <GroupHeader
        description={group.description}
        groupId={groupId}
        isOwner={Boolean(isOwner)}
        name={group.name}
      />

      <SeasonNavigationSection
        groupId={typedGroupId}
        isOwner={Boolean(isOwner)}
        onSeasonChange={updateSeasonParam}
        onSeasonStarted={showCurrentSeason}
        seasons={seasons ?? []}
        selectedSeasonId={selectedSeasonId ?? null}
        userId={userId}
      />

      <ActiveSessionsSection games={activeGames} />

      <GroupStandingsSection standings={standings ?? []} />

      <GroupManagementSections
        currentDescription={group.description}
        currentName={group.name}
        groupId={typedGroupId}
        isOwner={Boolean(isOwner)}
        userId={userId}
      >
        <RecentSessionsSection games={completedGames.slice(0, 5)} />
      </GroupManagementSections>
    </div>
  );
}
