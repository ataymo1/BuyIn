"use client";

import { useMutation } from "convex/react";
import { Calendar, FileUp } from "lucide-react";
import Link from "next/link";
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
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent pt-6 pb-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-purple-500/10 to-violet-500/10 blur-3xl" />
        </div>
        <div className="container relative mx-auto max-w-2xl px-4">
          <Skeleton className="mb-6 h-8 w-40" />
          <div className="flex items-start gap-6">
            <Skeleton className="hidden h-16 w-16 rounded-2xl sm:block" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-96" />
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="overflow-hidden border-0 shadow-black/5 shadow-xl">
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
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent pt-6 pb-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-purple-500/10 to-violet-500/10 blur-3xl" />
          </div>
          <div className="container relative mx-auto max-w-2xl px-4">
            <div className="flex items-start gap-6">
              <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 sm:flex">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="font-bold text-3xl tracking-tight sm:text-4xl">
                  Start a New Session
                </h1>
                <p className="max-w-xl text-lg text-muted-foreground">
                  Create a poker session to track buy-ins, cash-outs, and player
                  stats.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-2xl border bg-amber-500/10 p-6">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              You need to be a member of a group to create sessions. Join or
              create a group first.
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
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent pt-6 pb-12">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-purple-500/10 to-violet-500/10 blur-3xl" />
        </div>

        <div className="container relative mx-auto max-w-2xl px-4">
          <div className="flex items-start gap-6">
            <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 sm:flex">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="font-bold text-3xl tracking-tight sm:text-4xl">
                Start a New Session
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Create a poker session to track buy-ins, cash-outs, and player
                stats.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-2xl space-y-5 px-4 py-8">
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
          <div>
            <p className="font-medium">Already played on PokerNow?</p>
            <p className="text-muted-foreground text-sm">
              Import a downloaded ledger as a completed session.
            </p>
          </div>
          <Link
            href={`/games/import${defaultGroupId ? `?groupId=${defaultGroupId}` : ""}`}
          >
            <Button variant="outline">
              <FileUp className="mr-2 h-4 w-4" />
              Import New Session
            </Button>
          </Link>
        </div>
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
