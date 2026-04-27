"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useConvexUser } from "@/lib/convex-hooks";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GroupDetailSkeleton } from "./group-detail-skeleton";
import {
  ActiveSessionsSection,
  GroupHeader,
  GroupSettingsSection,
  GroupStandingsSection,
  PendingJoinRequestsSection,
  RecentSessionsSection,
} from "./group-detail-sections";

interface GroupDetailClientProps {
  groupId: string;
}

export function GroupDetailClient({ groupId }: GroupDetailClientProps) {
  const { userId, isLoading: userLoading } = useConvexUser();

  const group = useQuery(api.groups.getGroup, {
    groupId: groupId as Id<"groups">,
  });

  const isOwner = useQuery(
    api.groups.isGroupOwner,
    userId ? { groupId: groupId as Id<"groups">, userId } : "skip"
  );

  const standings = useQuery(api.groups.getGroupStandings, {
    groupId: groupId as Id<"groups">,
  });

  const games = useQuery(api.games.getGames, {
    groupIds: [groupId as Id<"groups">],
  });

  const isLoading = userLoading || group === undefined;

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

  const activeGames = (games ?? []).filter((g) => g.status === "ACTIVE");
  const completedGames = (games ?? []).filter((g) => g.status === "COMPLETED");

  return (
    <div className="space-y-8">
      <GroupHeader
        description={group.description}
        groupId={groupId}
        isOwner={Boolean(isOwner)}
        name={group.name}
      />

      <ActiveSessionsSection games={activeGames} />

      <GroupStandingsSection standings={standings ?? []} />

      {isOwner ? (
        <PendingJoinRequestsSection groupId={groupId as Id<"groups">} />
      ) : null}

      <RecentSessionsSection games={completedGames.slice(0, 5)} />

      {isOwner ? (
        <GroupSettingsSection
          currentDescription={group.description}
          currentName={group.name}
          groupId={groupId as Id<"groups">}
          groupName={group.name}
        />
      ) : null}
    </div>
  );
}
