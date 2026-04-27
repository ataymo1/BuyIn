"use client";

import { format } from "date-fns";
import { MapPin, Plus, Settings, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { DeleteGroupDialog } from "@/components/group/delete-group-dialog";
import { EditGroupDialog } from "@/components/group/edit-group-dialog";
import { PendingRequestsList } from "@/components/group/pending-requests-list";
import { VipBadge } from "@/components/icons/vip-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { getDisplayName } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

function GameTypeBadge({ gameType }: { gameType?: string | null }) {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800 text-xs dark:bg-violet-900 dark:text-violet-200">
      {gameType === "tournament" ? "Tournament" : "Cash"}
    </span>
  );
}

interface StandingWithRank {
  gamesPlayed: number;
  isFirst: boolean;
  isLast: boolean;
  player: {
    id?: string | null;
    name?: string | null;
    userId?: string | null;
  } | null;
  rank: number;
  totalProfit: number;
}

function getRankBackgroundClass(standing: StandingWithRank) {
  if (standing.isFirst) {
    return "bg-yellow-100 dark:bg-yellow-900";
  }
  if (standing.isLast) {
    return "bg-purple-100 dark:bg-purple-900";
  }
  return "bg-muted";
}

function RankIcon({ standing }: { standing: StandingWithRank }) {
  if (standing.isFirst) {
    return <Trophy className="h-5 w-5 text-yellow-500" />;
  }
  if (standing.isLast) {
    return <VipBadge className="h-5 w-5 text-purple-500" />;
  }
  return (
    <span className="font-bold text-muted-foreground">#{standing.rank}</span>
  );
}

function StandingCard({ standing }: { standing: StandingWithRank }) {
  const playerName = getDisplayName(standing.player?.name);

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getRankBackgroundClass(standing)}`}
        >
          <RankIcon standing={standing} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={playerName}>
            {playerName}
          </p>
          <p className="truncate text-muted-foreground text-sm">
            {standing.gamesPlayed} games played
          </p>
        </div>
      </div>
      <span
        className={`ml-3 shrink-0 font-bold text-lg ${
          standing.totalProfit >= 0 ? "text-green-600" : "text-red-600"
        }`}
      >
        {standing.totalProfit >= 0 ? "+" : ""}${standing.totalProfit.toFixed(2)}
      </span>
    </div>
  );
}

function renderStandingCard(standing: StandingWithRank) {
  const playerHref = standing.player?.userId
    ? `/players/${standing.player.userId}`
    : null;
  const cardContent = <StandingCard standing={standing} />;

  return playerHref ? (
    <Link href={playerHref}>{cardContent}</Link>
  ) : (
    cardContent
  );
}

function SessionListCard({
  emptyMessage,
  games,
  title,
  description,
}: {
  description: string;
  emptyMessage?: string;
  games: Array<{
    date: number | string;
    gamePlayers?: unknown[] | null;
    gameType?: string | null;
    id: string;
    location?: string | null;
  }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {games.map((game) => (
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
                      <GameTypeBadge gameType={game.gameType} />
                    </div>
                    {game.location ? (
                      <p className="flex items-center gap-1 text-muted-foreground text-sm">
                        <MapPin className="h-3 w-3" />
                        {game.location}
                      </p>
                    ) : null}
                    {"gamePlayers" in game ? (
                      <p className="text-muted-foreground text-sm">
                        {game.gamePlayers?.length ?? 0}{" "}
                        {(game.gamePlayers?.length ?? 0) === 1
                          ? "player"
                          : "players"}
                      </p>
                    ) : null}
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
  );
}

export function GroupHeader({
  description,
  groupId,
  isOwner,
  name,
}: {
  description?: string | null;
  groupId: string;
  isOwner: boolean;
  name: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-bold text-2xl sm:text-3xl">{name}</h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {isOwner ? (
        <Link href={`/games/new?groupId=${groupId}`}>
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </Link>
      ) : null}
    </div>
  );
}

export function ActiveSessionsSection({
  games,
}: {
  games: Array<{
    date: number | string;
    gamePlayers?: unknown[] | null;
    gameType?: string | null;
    id: string;
    location?: string | null;
  }>;
}) {
  if (games.length === 0) {
    return null;
  }

  return (
    <SessionListCard
      description="Currently active game sessions"
      games={games}
      title="Active Sessions"
    />
  );
}

export function GroupStandingsSection({
  standings,
}: {
  standings: Array<{
    gamesPlayed: number;
    player: {
      id?: string | null;
      name?: string | null;
      userId?: string | null;
    } | null;
    totalProfit: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          <CardTitle>Group Standings</CardTitle>
        </div>
        <CardDescription>Who is up and down in this group</CardDescription>
      </CardHeader>
      <CardContent>
        {standings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No standings data available yet.
          </p>
        ) : (
          <ResponsiveTable
            columns={[
              {
                key: "rank",
                header: "Rank",
                className: "w-12",
                render: (
                  standing: (typeof standings)[number] & {
                    rank: number;
                    isFirst: boolean;
                    isLast: boolean;
                  }
                ) => (
                  <div className="flex items-center gap-2">
                    {standing.isFirst ? (
                      <Trophy className="h-4 w-4 text-yellow-500" />
                    ) : null}
                    {standing.isLast ? (
                      <VipBadge className="h-4 w-4 text-purple-500" />
                    ) : null}
                    <span className="font-bold">#{standing.rank}</span>
                  </div>
                ),
              },
              {
                key: "player",
                header: "Player",
                render: (standing: (typeof standings)[number]) => {
                  const playerName = getDisplayName(standing.player?.name);
                  const playerHref = standing.player?.userId
                    ? `/players/${standing.player.userId}`
                    : null;

                  return playerHref ? (
                    <Link
                      className="block truncate font-medium transition-colors hover:text-primary hover:underline"
                      href={playerHref}
                      title={playerName}
                    >
                      {playerName}
                    </Link>
                  ) : (
                    <span
                      className="block truncate font-medium"
                      title={playerName}
                    >
                      {playerName}
                    </span>
                  );
                },
              },
              {
                key: "games",
                header: "Games",
                render: (standing: (typeof standings)[number]) =>
                  standing.gamesPlayed,
              },
              {
                key: "profit",
                header: "Net Profit",
                render: (standing: (typeof standings)[number]) => (
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
            data={standings.map((standing, index) => ({
              ...standing,
              rank: index + 1,
              isFirst: index === 0 && standings.length > 1,
              isLast: index === standings.length - 1 && standings.length > 1,
            }))}
            keyExtractor={(standing) => standing.player?.id ?? ""}
            renderCard={renderStandingCard}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function PendingJoinRequestsSection({
  groupId,
}: {
  groupId: Id<"groups">;
}) {
  return (
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
        <PendingRequestsList groupId={groupId} />
      </CardContent>
    </Card>
  );
}

export function RecentSessionsSection({
  games,
}: {
  games: Array<{
    date: number | string;
    gameType?: string | null;
    id: string;
    location?: string | null;
  }>;
}) {
  return (
    <SessionListCard
      description="Completed game sessions"
      emptyMessage="No completed sessions"
      games={games}
      title="Recent Sessions"
    />
  );
}

export function GroupSettingsSection({
  currentDescription,
  currentName,
  groupId,
  groupName,
}: {
  currentDescription?: string | null;
  currentName: string;
  groupId: Id<"groups">;
  groupName: string;
}) {
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Group Settings</CardTitle>
          </div>
          <EditGroupDialog
            currentDescription={currentDescription ?? undefined}
            currentName={currentName}
            groupId={groupId}
          />
        </CardHeader>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <DeleteGroupDialog groupId={groupId} groupName={groupName} />
        </CardHeader>
      </Card>
    </>
  );
}
