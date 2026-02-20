"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
  Calendar,
  DollarSign,
  Lock,
  TrendingUp,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { EarningsOverTimeChart } from "@/components/stats/earnings-over-time-chart";
import { StatsCard } from "@/components/stats/stats-card";
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
      </div>
    );
  }

  // Handle private profiles
  if (stats.isPrivate) {
    return (
      <div className="space-y-8">
        {/* Private Profile Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 text-center">
              {/* Avatar */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary ring-4 ring-background sm:h-24 sm:w-24 sm:text-4xl">
                {stats.playerName.charAt(0).toUpperCase()}
              </div>

              {/* Profile Info */}
              <div className="space-y-4">
                <h1 className="font-bold text-2xl sm:text-3xl">
                  {stats.playerName}
                </h1>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="h-5 w-5" />
                  <p className="text-sm sm:text-base">
                    This profile is private
                  </p>
                </div>
                <p className="mx-auto max-w-md text-muted-foreground text-sm">
                  This player has chosen to keep their stats and payment methods private.
                  Request to view their profile to access this information.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary ring-4 ring-background sm:h-24 sm:w-24 sm:text-4xl">
              {stats.playerName.charAt(0).toUpperCase()}
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="font-bold text-2xl sm:text-3xl">
                  {stats.playerName}
                </h1>
                <p className="text-muted-foreground">
                  {stats.gamesPlayed} games played •{" "}
                  <span
                    className={
                      stats.netProfit >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {stats.netProfit >= 0 ? "+" : ""}${stats.netProfit.toFixed(2)} lifetime
                  </span>
                </p>
              </div>

              {/* Payment Methods - Inline */}
              {(stats.venmo || stats.zelle) && (
                <div className="flex flex-wrap gap-3">
                  {stats.venmo && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border">
                      <span className="font-semibold text-blue-600">Venmo</span>
                      <span className="font-medium">{stats.venmo}</span>
                    </div>
                  )}
                  {stats.zelle && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border">
                      <span className="font-semibold text-purple-600">Zelle</span>
                      <span className="font-medium">{stats.zelle}</span>
                    </div>
                  )}
                </div>
              )}

              {/* No Payment Methods Notice */}
              {!stats.venmo && !stats.zelle && (
                <p className="text-sm text-muted-foreground italic">
                  No payment methods set up
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

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

      <EarningsOverTimeChart
        data={stats.earningsOverTime}
        description="Net profit progression by session date"
        title="Earnings Over Time"
      />

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
