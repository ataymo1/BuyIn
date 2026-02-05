"use client";

import { useMutation } from "convex/react";
import { Calendar, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameForm } from "@/components/game/game-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormFieldSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useConvexUser, useUserGroups } from "@/lib/convex-hooks";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function NewGameSkeleton() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent pb-12 pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-purple-500/10 to-violet-500/10 blur-3xl" />
        </div>
        <div className="container relative mx-auto max-w-2xl px-4">
          <Skeleton className="mb-6 h-8 w-40" />
          <div className="flex items-start gap-6">
            <Skeleton className="hidden sm:block h-16 w-16 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-96" />
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="overflow-hidden border-0 shadow-xl shadow-black/5">
          <CardHeader className="border-b bg-muted/30 pb-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <FormFieldSkeleton />
            <FormFieldSkeleton />
            <FormFieldSkeleton />
            <Skeleton className="mt-4 h-12 w-full" />
          </CardContent>
        </Card>
      </div>
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

  // Allow any group member to create sessions (they become the banker)
  const memberGroups = groups.filter((g) => g != null);

  if (memberGroups.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        {/* Header Section */}
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent pb-12 pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-purple-500/10 to-violet-500/10 blur-3xl" />
          </div>
          <div className="container relative mx-auto max-w-2xl px-4">
            <div className="flex items-start gap-6">
              <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="font-bold text-3xl sm:text-4xl tracking-tight">
                  Start a New Session
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Create a poker session to track buy-ins, cash-outs, and player stats.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-2xl border bg-amber-500/10 p-6">
            <p className="text-amber-700 dark:text-amber-400 font-medium">
              You need to be a member of a group to create sessions. Join or create a group first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function handleCreateGame(data: {
    groupId: string;
    date: string;
    location?: string;
    gameType?: "cash" | "tournament";
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
      gameType: data.gameType,
      createdById: userId,
    });

    router.push(`/games/${gameId}`);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent pb-12 pt-6">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-purple-500/10 to-violet-500/10 blur-3xl" />
        </div>

        <div className="container relative mx-auto max-w-2xl px-4">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="font-bold text-3xl sm:text-4xl tracking-tight">
                Start a New Session
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Create a poker session to track buy-ins, cash-outs, and player stats.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <GameForm
          defaultGroupId={defaultGroupId ?? undefined}
          groups={memberGroups.map((g) => ({
            id: g?._id ?? "",
            name: g?.name ?? "",
            role: g?.role ?? "MEMBER",
          }))}
          onSubmit={handleCreateGame}
        />
      </div>
    </div>
  );
}
