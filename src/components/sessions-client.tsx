"use client";

import { format } from "date-fns";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SessionFilters } from "@/components/sessions/session-filters";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { useGames, usePlayer, useUserGroups } from "@/lib/convex-hooks";
import type { Id } from "../../convex/_generated/dataModel";

function getProfitColorClass(profit: number): string {
  if (profit > 0) {
    return "text-green-600";
  }
  if (profit < 0) {
    return "text-red-600";
  }
  return "text-muted-foreground";
}

function getStatusColorClass(status: string): string {
  if (status === "ACTIVE") {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }
  if (status === "COMPLETED") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
}

export function SessionsClient() {
  const searchParams = useSearchParams();
  const groupIdParam = searchParams.get("groupId");
  const statusParam = searchParams.get("status");

  const { groups, isLoading: groupsLoading } = useUserGroups();
  const { player, isLoading: playerLoading } = usePlayer();

  const { games, isLoading: gamesLoading } = useGames({
    groupId:
      groupIdParam && groupIdParam !== "all"
        ? (groupIdParam as Id<"groups">)
        : undefined,
    status:
      statusParam && statusParam !== "all"
        ? (statusParam as "ACTIVE" | "COMPLETED")
        : undefined,
  });

  const isLoading = groupsLoading || playerLoading || gamesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gamesList = games ?? [];

  // Calculate stats
  const totalSessions = gamesList.length;
  const activeSessions = gamesList.filter((g) => g.status === "ACTIVE").length;
  const completedSessions = gamesList.filter(
    (g) => g.status === "COMPLETED"
  ).length;

  // Get user's profit for each game (only for completed games)
  const gamesWithUserProfit = gamesList.map((game) => {
    let userProfit: number | null = null;
    let isParticipant = false;
    if (player) {
      const userGamePlayer = game.gamePlayers?.find(
        (gp) => gp.playerId === player._id
      );
      if (userGamePlayer) {
        isParticipant = true;
        // Only calculate profit for completed games
        if (game.status === "COMPLETED") {
          const buyIn = userGamePlayer.buyIn ?? 0;
          const cashOut = userGamePlayer.cashOut ?? 0;
          userProfit = cashOut - buyIn;
        }
      }
    }
    return { ...game, userProfit, isParticipant };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl sm:text-3xl">Session History</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          View and filter your poker session history across all groups
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Total Sessions
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalSessions}</div>
            <p className="text-muted-foreground text-xs">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-green-600">
              {activeSessions}
            </div>
            <p className="text-muted-foreground text-xs">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-blue-600">
              {completedSessions}
            </div>
            <p className="text-muted-foreground text-xs">Finished sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <SessionFilters
        groups={groups.map((g) => ({ id: g?._id ?? "", name: g?.name ?? "" }))}
      />

      {/* Sessions Table */}
      {gamesList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No sessions found matching your filters.
            </p>
            <p className="text-muted-foreground text-sm">
              Sessions are created from group pages. Visit a group to create a
              new session.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Sessions</CardTitle>
            <CardDescription>
              {totalSessions} {totalSessions === 1 ? "session" : "sessions"}{" "}
              found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              data={gamesWithUserProfit}
              keyExtractor={(game) => game.id}
              columns={[
                {
                  key: "date",
                  header: "Date",
                  render: (game) => (
                    <div className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      {format(new Date(game.date), "MMM dd, yyyy")}
                    </div>
                  ),
                },
                {
                  key: "group",
                  header: "Group",
                  render: (game) => (
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      <Link
                        className="hover:underline"
                        href={`/groups/${game.group?.id}`}
                      >
                        {game.group?.name}
                      </Link>
                    </div>
                  ),
                },
                {
                  key: "location",
                  header: "Location",
                  render: (game) =>
                    game.location ? (
                      <div className="flex items-center">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        {game.location}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (game) => (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusColorClass(game.status)}`}
                    >
                      {game.status}
                    </span>
                  ),
                },
                {
                  key: "players",
                  header: "Players",
                  render: (game) => game.gamePlayers?.length ?? 0,
                },
                {
                  key: "result",
                  header: "Your Result",
                  render: (game) =>
                    game.userProfit !== null ? (
                      <span
                        className={`font-medium ${getProfitColorClass(game.userProfit)}`}
                      >
                        {game.userProfit > 0 ? "+" : ""}$
                        {game.userProfit.toFixed(2)}
                      </span>
                    ) : game.isParticipant && game.status === "ACTIVE" ? (
                      <span className="font-medium text-yellow-600 dark:text-yellow-500">
                        Pending
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (game) => (
                    <Link href={`/games/${game.id}`}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  ),
                },
              ]}
              renderCard={(game) => (
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(game.date), "MMM dd, yyyy")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
                        <Users className="h-3 w-3" />
                        <Link
                          className="hover:underline"
                          href={`/groups/${game.group?.id}`}
                        >
                          {game.group?.name}
                        </Link>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusColorClass(game.status)}`}
                    >
                      {game.status}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-3 text-sm">
                    {game.location && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {game.location}
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      {game.gamePlayers?.length ?? 0} players
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      {game.userProfit !== null ? (
                        <span
                          className={`font-semibold ${getProfitColorClass(game.userProfit)}`}
                        >
                          {game.userProfit > 0 ? "+" : ""}$
                          {game.userProfit.toFixed(2)}
                        </span>
                      ) : game.isParticipant && game.status === "ACTIVE" ? (
                        <span className="font-medium text-yellow-600 dark:text-yellow-500">
                          Pending
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Not participating
                        </span>
                      )}
                    </div>
                    <Link href={`/games/${game.id}`}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
