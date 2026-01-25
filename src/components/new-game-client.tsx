"use client";

import { useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameForm } from "@/components/game/game-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormFieldSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useConvexUser, useUserGroups } from "@/lib/convex-hooks";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function NewGameSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-56" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <FormFieldSkeleton />
          <FormFieldSkeleton />
          <FormFieldSkeleton />
          <Skeleton className="mt-4 h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function NewGameClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultGroupId = searchParams.get("groupId");

  const { userId, isLoading: userLoading } = useConvexUser();
  const { groups, isLoading: groupsLoading } = useUserGroups();
  const createGame = useMutation(api.games.createGame);

  const isLoading = userLoading || groupsLoading;

  if (isLoading) {
    return <NewGameSkeleton />;
  }

  // Filter to only groups where user is owner
  const ownedGroups = groups.filter((g) => g?.role === "OWNER");

  if (ownedGroups.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-bold text-3xl">New Session</h1>
          <p className="text-muted-foreground">
            Create a new poker game session
          </p>
        </div>
        <div className="rounded border bg-muted p-4">
          <p className="text-muted-foreground text-sm">
            You need to be a group owner to create sessions. Create a group
            first or ask a group owner to make you an owner.
          </p>
        </div>
      </div>
    );
  }

  async function handleCreateGame(data: {
    groupId: string;
    date: string;
    location?: string;
  }) {
    if (!userId) {
      throw new Error("Unauthorized");
    }

    if (!data.groupId) {
      throw new Error("Group ID is required");
    }

    const gameId = await createGame({
      groupId: data.groupId as Id<"groups">,
      date: new Date(data.date).getTime(),
      location: data.location,
      createdById: userId,
    });

    router.push(`/games/${gameId}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-3xl">New Session</h1>
        <p className="text-muted-foreground">Create a new poker game session</p>
      </div>
      <GameForm
        defaultGroupId={defaultGroupId ?? undefined}
        groups={ownedGroups.map((g) => ({
          id: g?._id ?? "",
          name: g?.name ?? "",
          role: g?.role ?? "MEMBER",
        }))}
        onSubmit={handleCreateGame}
      />
    </div>
  );
}
