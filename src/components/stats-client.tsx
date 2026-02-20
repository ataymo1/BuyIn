"use client";

import { EarningsOverTimeChart } from "@/components/stats/earnings-over-time-chart";
import { StatsCard } from "@/components/stats/stats-card";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
    PageHeaderSkeleton,
    Skeleton,
    StatsCardSkeleton,
    TableRowSkeleton,
} from "@/components/ui/skeleton";
import { useDetailedStats, useUserGroups } from "@/lib/convex-hooks";
import { Calendar, DollarSign, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

function StatsSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>

      {/* Stats by Group Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRowSkeleton key={i} columns={2} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function StatsClient() {
  const { groups, isLoading: groupsLoading } = useUserGroups();
  const { detailedStats, isLoading: statsLoading } = useDetailedStats();

  const isLoading = groupsLoading || statsLoading;

  if (isLoading) {
    return <StatsSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-3xl">Your Statistics</h1>
        <p className="text-muted-foreground">
          Personal stats across all your groups
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          description="Across all groups"
          icon={detailedStats.overview.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          title="Net Profit"
          trend={{
            value: detailedStats.overview.netProfit >= 0 ? "Positive" : "Negative",
            isPositive: detailedStats.overview.netProfit >= 0,
          }}
          value={`${detailedStats.overview.netProfit >= 0 ? "+" : ""}$${detailedStats.overview.netProfit.toFixed(2)}`}
          valueColorMode="profit"
          numericValue={detailedStats.overview.netProfit}
        />
        <StatsCard
          description="All time"
          icon={<DollarSign className="h-4 w-4" />}
          title="Total Buy-Ins"
          value={`$${detailedStats.overview.totalBuyIns.toFixed(2)}`}
        />
        <StatsCard
          description="All time"
          icon={<DollarSign className="h-4 w-4" />}
          title="Total Cash-Outs"
          value={`$${detailedStats.overview.totalCashOuts.toFixed(2)}`}
        />
        <StatsCard
          description="Sessions participated"
          icon={<Calendar className="h-4 w-4" />}
          title="Games Played"
          value={detailedStats.overview.gamesPlayed}
        />
      </div>

      <EarningsOverTimeChart
        data={detailedStats.earningsOverTime}
        description="Net profit progression by session date"
        title="Earnings Over Time"
      />

      {/* Stats by Group */}
      <Card>
        <CardHeader>
          <CardTitle>Stats by Group</CardTitle>
          <CardDescription>Your performance breakdown by group</CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No groups yet. Join a group to see your stats.
            </p>
          ) : (
            <ResponsiveTable
              data={groups.filter((g) => g !== null)}
              keyExtractor={(group) => group?._id ?? ""}
              columns={[
                {
                  key: "name",
                  header: "Group",
                  render: (group) => (
                    <span className="font-medium">{group?.name}</span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (group) => (
                    <Link href={`/groups/${group?._id}`}>
                      <Button size="sm" variant="outline">
                        View Group
                      </Button>
                    </Link>
                  ),
                },
              ]}
              renderCard={(group) => (
                <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="font-medium">{group?.name}</span>
                  </div>
                  <Link href={`/groups/${group?._id}`}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
