"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { MapPin, Plus, Settings, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { VipBadge } from "@/components/icons/vip-badge";
import { DeleteGroupDialog } from "@/components/group/delete-group-dialog";
import { EditGroupDialog } from "@/components/group/edit-group-dialog";
import { PendingRequestsList } from "@/components/group/pending-requests-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Skeleton, TableRowSkeleton } from "@/components/ui/skeleton";
import { useConvexUser } from "@/lib/convex-hooks";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function GroupDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Standings Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRowSkeleton key={i} columns={4} />
          ))}
        </CardContent>
      </Card>

      {/* Active and Recent Sessions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Section Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded border p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface GroupDetailClientProps {
  groupId: string;
}

export function GroupDetailClient({ groupId }: GroupDetailClientProps) {
  const { userId, isLoading: userLoading } = useConvexUser();

  const group = useQuery(api.groups.getGroup, {
    groupId: groupId as Id<"groups">,
  });

  const isOwner = useQuery(
    api.groups.isGroupOwner,
    userId ? { groupId: groupId as Id<"groups">, userId } : "skip"
  );

  const standings = useQuery(api.groups.getGroupStandings, {
    groupId: groupId as Id<"groups">,
  });

  const games = useQuery(api.games.getGames, {
    groupIds: [groupId as Id<"groups">],
  });

  const isLoading = userLoading || group === undefined;

  if (isLoading) {
    return <GroupDetailSkeleton />;
  }

  if (!group) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Group not found</p>
        <Link href="/groups">
          <Button className="mt-4" variant="outline">
            Back to Groups
          </Button>
        </Link>
      </div>
    );
  }

  const activeGames = (games ?? []).filter((g) => g.status === "ACTIVE");
  const completedGames = (games ?? []).filter((g) => g.status === "COMPLETED");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground">{group.description}</p>
          )}
        </div>
        {isOwner && (
          <Link href={`/games/new?groupId=${groupId}`}>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </Link>
        )}
      </div>

      {/* Standings/Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <CardTitle>Group Standings</CardTitle>
          </div>
          <CardDescription>Who is up and down in this group</CardDescription>
        </CardHeader>
        <CardContent>
          {(standings ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No standings data available yet.
            </p>
          ) : (
            <ResponsiveTable
              data={(standings ?? []).map((standing, index) => ({
                ...standing,
                rank: index + 1,
                isFirst: index === 0 && (standings ?? []).length > 1,
                isLast: index === (standings ?? []).length - 1 && (standings ?? []).length > 1,
              }))}
              keyExtractor={(standing) => standing.player?.id ?? ""}
              columns={[
                {
                  key: "rank",
                  header: "Rank",
                  className: "w-12",
                  render: (standing) => (
                    <div className="flex items-center gap-2">
                      {standing.isFirst && (
                        <Trophy className="h-4 w-4 text-yellow-500" />
                      )}
                      {standing.isLast && (
                        <VipBadge className="h-4 w-4 text-purple-500" />
                      )}
                      <span className="font-bold">#{standing.rank}</span>
                    </div>
                  ),
                },
                {
                  key: "player",
                  header: "Player",
                  render: (standing) => (
                    standing.player?.id ? (
                      <Link
                        className="font-medium transition-colors hover:text-primary hover:underline"
                        href={`/players/${standing.player.id}`}
                      >
                        {standing.player?.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{standing.player?.name}</span>
                    )
                  ),
                },
                {
                  key: "games",
                  header: "Games",
                  render: (standing) => standing.gamesPlayed,
                },
                {
                  key: "profit",
                  header: "Net Profit",
                  render: (standing) => (
                    <span
                      className={`font-bold ${
                        standing.totalProfit >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {standing.totalProfit >= 0 ? "+" : ""}$
                      {standing.totalProfit.toFixed(2)}
                    </span>
                  ),
                },
              ]}
              renderCard={(standing) => (
                <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        standing.isFirst
                          ? "bg-yellow-100 dark:bg-yellow-900"
                          : standing.isLast
                            ? "bg-purple-100 dark:bg-purple-900"
                            : "bg-muted"
                      }`}
                    >
                      {standing.isFirst ? (
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      ) : standing.isLast ? (
                        <VipBadge className="h-5 w-5 text-purple-500" />
                      ) : (
                        <span className="font-bold text-muted-foreground">
                          #{standing.rank}
                        </span>
                      )}
                    </div>
                    <div>
                      {standing.player?.id ? (
                        <Link
                          className="font-medium transition-colors hover:text-primary hover:underline"
                          href={`/players/${standing.player.id}`}
                        >
                          {standing.player?.name}
                        </Link>
                      ) : (
                        <p className="font-medium">{standing.player?.name}</p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        {standing.gamesPlayed} games played
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-bold text-lg ${
                      standing.totalProfit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {standing.totalProfit >= 0 ? "+" : ""}$
                    {standing.totalProfit.toFixed(2)}
                  </span>
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Currently active game sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {activeGames.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active sessions
              </p>
            ) : (
              <div className="space-y-2">
                {activeGames.map((game) => (
                  <Link
                    className="block rounded border p-3 transition-colors hover:bg-accent"
                    href={`/games/${game.id}`}
                    key={game.id}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {format(new Date(game.date), "MMM dd, yyyy")}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-medium text-xs text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                            {game.gameType === "tournament" ? "Tournament" : "Cash"}
                          </span>
                        </div>
                        {game.location && (
                          <p className="flex items-center gap-1 text-muted-foreground text-sm">
                            <MapPin className="h-3 w-3" />
                            {game.location}
                          </p>
                        )}
                        <p className="text-muted-foreground text-sm">
                          {game.gamePlayers?.length ?? 0}{" "}
                          {(game.gamePlayers?.length ?? 0) === 1
                            ? "player"
                            : "players"}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost">
                        View
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>Completed game sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {completedGames.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No completed sessions
              </p>
            ) : (
              <div className="space-y-2">
                {completedGames.slice(0, 5).map((game) => (
                  <Link
                    className="block rounded border p-3 transition-colors hover:bg-accent"
                    href={`/games/${game.id}`}
                    key={game.id}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {format(new Date(game.date), "MMM dd, yyyy")}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-medium text-xs text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                            {game.gameType === "tournament" ? "Tournament" : "Cash"}
                          </span>
                        </div>
                        {game.location && (
                          <p className="flex items-center gap-1 text-muted-foreground text-sm">
                            <MapPin className="h-3 w-3" />
                            {game.location}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost">
                        View
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Join Requests section (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <CardTitle>Pending Join Requests</CardTitle>
            </div>
            <CardDescription>
              Review and manage join requests from other users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingRequestsList groupId={groupId as Id<"groups">} />
          </CardContent>
        </Card>
      )}

      {/* Members section */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({group.members?.length ?? 0})</CardTitle>
          <CardDescription>Group members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(group.members ?? []).map((member) => (
              <Link
                href={`/players/${member.user?.id}`}
                className="flex items-center justify-between rounded border p-3 transition-colors hover:bg-accent"
                key={member._id}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {member.user?.name?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="font-medium">{member.user?.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {member.role === "OWNER" ? "Owner" : "Member"}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost">
                  View Profile
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Group Settings - Owner Only */}
      {isOwner && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Group Settings</CardTitle>
            </div>
            <EditGroupDialog
              groupId={groupId as Id<"groups">}
              currentName={group.name}
              currentDescription={group.description}
            />
          </CardHeader>
        </Card>
      )}

      {/* Danger Zone - Owner Only */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <DeleteGroupDialog
              groupId={groupId as Id<"groups">}
              groupName={group.name}
            />
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
