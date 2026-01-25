"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { StatsCard } from "@/components/stats/stats-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton, StatsCardSkeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";

function PlayerStatsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-9 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Recent Games Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded border p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PlayerStatsClientProps {
  userId: string;
}

export function PlayerStatsClient({ userId }: PlayerStatsClientProps) {
  const stats = useQuery(api.stats.getPlayerStats, { userId });

  if (stats === undefined) {
    return <PlayerStatsSkeleton />;
  }

  if (!stats) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Player not found</p>
        <Link href="/groups">
          <Button className="mt-4" variant="outline">
            Back to Groups
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/groups">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-3xl">{stats.playerName}'s Stats</h1>
            <p className="text-muted-foreground">
              Personal statistics across all groups
            </p>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          description="Across all groups"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Net Profit"
          trend={{
            value: stats.netProfit >= 0 ? "Positive" : "Negative",
            isPositive: stats.netProfit >= 0,
          }}
          value={`${stats.netProfit >= 0 ? "+" : ""}$${stats.netProfit.toFixed(2)}`}
          valueColorMode="profit"
          numericValue={stats.netProfit}
        />
        <StatsCard
          description="All time"
          icon={<DollarSign className="h-4 w-4" />}
          title="Total Buy-Ins"
          value={`$${stats.totalBuyIns.toFixed(2)}`}
        />
        <StatsCard
          description="All time"
          icon={<DollarSign className="h-4 w-4" />}
          title="Total Cash-Outs"
          value={`$${stats.totalCashOuts.toFixed(2)}`}
        />
        <StatsCard
          description="Sessions participated"
          icon={<Calendar className="h-4 w-4" />}
          title="Games Played"
          value={stats.gamesPlayed}
        />
      </div>

      {/* Recent Games */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Games</CardTitle>
          <CardDescription>Latest game sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentGames.length === 0 ? (
            <p className="text-muted-foreground text-sm">No games yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentGames.map((game) => (
                <Link
                  className="block rounded border p-3 transition-colors hover:bg-accent"
                  href={`/games/${game.gameId}`}
                  key={game.gameId}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {format(new Date(game.date), "MMM dd, yyyy")}
                      </p>
                      <p className="flex items-center gap-1 text-muted-foreground text-sm">
                        <UserCog className="h-3 w-3" />
                        {game.groupName}
                      </p>
                      <p className="text-sm">
                        Buy-In: ${game.buyIn.toFixed(2)}
                        {game.cashOut !== null &&
                          ` • Cash-Out: $${game.cashOut.toFixed(2)}`}
                        {game.profit !== null && (
                          <span
                            className={`ml-2 ${
                              game.profit >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {game.profit >= 0 ? "+" : ""}$
                            {game.profit.toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
