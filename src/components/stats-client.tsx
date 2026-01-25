"use client";

import { Calendar, DollarSign, Loader2, TrendingDown, TrendingUp, Users } from "lucide-react";
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
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { useUserGroups, useUserStats } from "@/lib/convex-hooks";

export function StatsClient() {
  const { groups, isLoading: groupsLoading } = useUserGroups();
  const { stats, isLoading: statsLoading } = useUserStats();

  const isLoading = groupsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
          icon={stats.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buy-In Summary</CardTitle>
            <CardDescription>
              Total buy-ins across all your groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-3xl">
              ${stats.totalBuyIns.toFixed(2)}
            </div>
            <p className="mt-2 text-muted-foreground text-sm">
              Total amount invested in games
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash-Out Summary</CardTitle>
            <CardDescription>
              Total cash-outs across all your groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-3xl">
              ${stats.totalCashOuts.toFixed(2)}
            </div>
            <p className="mt-2 text-muted-foreground text-sm">
              Total amount cashed out
            </p>
          </CardContent>
        </Card>
      </div>

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
