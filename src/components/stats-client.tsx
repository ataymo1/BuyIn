"use client";

import { Calendar, DollarSign, Loader2, TrendingUp } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          icon={<TrendingUp className="h-4 w-4" />}
          title="Net Profit"
          trend={{
            value: stats.netProfit >= 0 ? "Positive" : "Negative",
            isPositive: stats.netProfit >= 0,
          }}
          value={`$${stats.netProfit.toFixed(2)}`}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group?._id}>
                    <TableCell className="font-medium">{group?.name}</TableCell>
                    <TableCell>
                      <Link href={`/groups/${group?._id}`}>
                        <Button size="sm" variant="outline">
                          View Group
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
