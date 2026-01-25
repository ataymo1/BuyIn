"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CardSkeleton,
  GameItemSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";
import { useConvexUser, usePlayer, useUserGroups } from "@/lib/convex-hooks";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
    ArrowRight,
    BarChart3,
    Calendar,
    MapPin,
    Play,
    Plus,
    User,
    Users
} from "lucide-react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";

function getProfitColorClass(profit: number): string {
  if (profit > 0) {
    return "text-green-600";
  }
  if (profit < 0) {
    return "text-red-600";
  }
  return "text-muted-foreground";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero Header Skeleton */}
      <div>
        <Skeleton className="h-9 w-48" />
      </div>

      {/* Quick Actions Skeleton */}
      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Recent Games Skeleton */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <Card>
          <CardContent className="divide-y pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <GameItemSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function DashboardClient() {
  const { isLoading: userLoading } = useConvexUser();
  const { groups, groupIds, isLoading: groupsLoading } = useUserGroups();
  const { player, isLoading: playerLoading } = usePlayer();

  // Get all recent games (both active and completed)
  const allGames = useQuery(
    api.games.getGames,
    groupIds.length > 0 ? { groupIds } : "skip"
  );

  const isLoading = userLoading || groupsLoading || playerLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Get recent games (up to 5)
  const recentGames = (allGames ?? []).slice(0, 5);

  // Calculate user profit for games
  const recentGamesWithProfit = recentGames.map((game) => {
    let userProfit: number | null = null;
    if (player) {
      const userGamePlayer = game.gamePlayers?.find(
        (gp) => gp.playerId === player._id
      );
      if (userGamePlayer && game.status === "COMPLETED") {
        const buyIn = userGamePlayer.buyIn ?? 0;
        const cashOut = userGamePlayer.cashOut ?? 0;
        userProfit = cashOut - buyIn;
      }
    }
    return { ...game, userProfit };
  });

  const hasGroups = groups.length > 0;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div>
        <h1 className="font-bold text-3xl">Welcome back!</h1>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 font-semibold text-xl">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* New Game - only show if user has groups */}
          {hasGroups && (
            <Link href="/games/new">
              <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <Play className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Start New Game</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* New Group */}
          <Link href="/groups/new">
            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold">Create Group</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* View Groups */}
          {hasGroups && (
            <Link href="/groups">
              <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Your Groups</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* View Stats */}
          <Link href="/stats">
            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                  <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold">View Stats</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Profile Info */}
          <Link href="/profile">
            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
                  <User className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="font-semibold">Profile Info</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Recent Games */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <h2 className="font-semibold text-xl">Recent Games</h2>
          </div>
          {recentGamesWithProfit.length > 0 && (
            <Link href="/sessions">
              <Button size="sm" variant="ghost">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {recentGamesWithProfit.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-semibold text-lg">No games yet</h3>
              <p className="mb-6 text-muted-foreground text-sm">
                {hasGroups
                  ? "Start your first poker session to track your games"
                  : "Create a group first, then start a poker session"}
              </p>
              <Link href={hasGroups ? "/games/new" : "/groups/new"}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {hasGroups ? "Start New Game" : "Create Your First Group"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y pt-4">
              {recentGamesWithProfit.map((game) => (
                <Link
                  className="-mx-4 flex items-center justify-between px-4 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-accent"
                  href={`/games/${game.id}`}
                  key={game.id}
                >
                  <div className="flex items-center gap-3">
                    {/* Status indicator */}
                    {game.status === "ACTIVE" && (
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    )}
                    {game.status === "COMPLETED" && (
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                    )}
                    {game.status === "CANCELLED" && (
                      <div className="h-2 w-2 rounded-full bg-red-400" />
                    )}
                    <div>
                      <p className="font-medium">
                        {format(new Date(game.date), "MMM dd, yyyy")}
                      </p>
                      <p className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Users className="h-3 w-3" />
                        {game.group?.name}
                        {game.location && (
                          <>
                            {" • "}
                            <MapPin className="h-3 w-3" />
                            {game.location}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {game.userProfit !== null && (
                      <span
                        className={`font-bold ${getProfitColorClass(game.userProfit)}`}
                      >
                        {game.userProfit > 0 ? "+" : ""}$
                        {game.userProfit.toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${
                        game.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : game.status === "COMPLETED"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {game.status}
                    </span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
