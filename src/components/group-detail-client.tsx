"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Loader2, MapPin, Plus, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { PendingRequestsList } from "@/components/group/pending-requests-list";
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
import { useConvexUser } from "@/lib/convex-hooks";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground">{group.description}</p>
          )}
        </div>
        {isOwner && (
          <Link href={`/games/new?groupId=${groupId}`}>
            <Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Games</TableHead>
                  <TableHead>Net Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(standings ?? []).map((standing, index) => (
                  <TableRow key={standing.player?.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {index === 0 && (standings ?? []).length > 1 && (
                          <Trophy className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="font-bold">#{index + 1}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {standing.player?.name}
                    </TableCell>
                    <TableCell>{standing.gamesPlayed}</TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                        <p className="font-medium">
                          {format(new Date(game.date), "MMM dd, yyyy")}
                        </p>
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
                        <p className="font-medium">
                          {format(new Date(game.date), "MMM dd, yyyy")}
                        </p>
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
              <div
                className="flex items-center justify-between rounded border p-3"
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
