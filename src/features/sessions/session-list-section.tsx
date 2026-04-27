"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { format } from "date-fns";
import {
  Banknote,
  Calendar,
  LogIn,
  MapPin,
  type LucideIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  getGameTypeLabel,
  getProfitColorClass,
  getStatusColorClass,
} from "./session-utils";
import type { SessionListItem } from "./types";

interface SessionListSectionProps {
  games: SessionListItem[];
  icon: LucideIcon;
  iconClassName: string;
  isJoiningId?: string | null;
  mode: "join" | "view";
  onJoinSession?: (gameId: string) => void;
  title: string;
  userId?: string | null;
}

export function SessionListSection({
  games,
  icon: Icon,
  iconClassName,
  isJoiningId = null,
  mode,
  onJoinSession,
  title,
  userId,
}: SessionListSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-xl">
          <Icon className={`h-5 w-5 ${iconClassName}`} />
          {title}
        </h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            columns={[
              {
                key: "date",
                header: "Date",
                render: (game: SessionListItem) => (
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(new Date(game.date), "MMM dd, yyyy")}
                  </div>
                ),
              },
              {
                key: "group",
                header: "Group",
                render: (game: SessionListItem) => (
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
                render: (game: SessionListItem) =>
                  game.location ? (
                    <div className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                      {game.location}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  ),
              },
              {
                key: "players",
                header: "Players",
                render: (game: SessionListItem) => game.gamePlayers?.length ?? 0,
              },
              {
                key: "gameType",
                header: "Type",
                render: (game: SessionListItem) => (
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-medium text-xs text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                    {getGameTypeLabel(game.gameType)}
                  </span>
                ),
              },
              ...(mode === "view"
                ? [
                    {
                      key: "result",
                      header: "Your Result",
                      render: (game: SessionListItem) =>
                        game.userProfit !== null ? (
                          <span
                            className={`font-medium ${getProfitColorClass(game.userProfit)}`}
                          >
                            {game.userProfit > 0 ? "+" : ""}$
                            {game.userProfit.toFixed(2)}
                          </span>
                        ) : game.status === "ACTIVE" ? (
                          <span className="font-medium text-yellow-600 dark:text-yellow-500">
                            Pending
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        ),
                    },
                  ]
                : []),
              {
                key: "banker",
                header: "Banker",
                render: (game: SessionListItem) => {
                  const isBanker = game.createdBy?.id === userId;
                  if (isBanker) {
                    return (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        <Banknote className="h-3 w-3" />
                        You
                      </span>
                    );
                  }

                  return game.createdBy ? (
                    <span className="text-muted-foreground text-sm">
                      {game.createdBy.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  );
                },
              },
              {
                key: "actions",
                header: "Actions",
                render: (game: SessionListItem) =>
                  mode === "join" ? (
                    <Button
                      disabled={isJoiningId === game.id}
                      onClick={() => onJoinSession?.(game.id)}
                      size="sm"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      {isJoiningId === game.id ? "Joining..." : "Join Session"}
                    </Button>
                  ) : (
                    <Link href={`/games/${game.id}`}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  ),
              },
            ]}
            data={games}
            keyExtractor={(game: SessionListItem) => game.id}
            renderCard={(game: SessionListItem) => {
              const isBanker = game.createdBy?.id === userId;

              return (
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(game.date), "MMM dd, yyyy")}
                        </span>
                        {isBanker ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            <Banknote className="h-3 w-3" />
                            Banker
                          </span>
                        ) : null}
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
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-medium text-xs text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                        {getGameTypeLabel(game.gameType)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusColorClass(game.status)}`}
                      >
                        {game.status}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-3 text-sm">
                    {game.location ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {game.location}
                      </div>
                    ) : null}
                    <div className="text-muted-foreground">
                      {game.gamePlayers?.length ?? 0} players
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {mode === "view" ? (
                      <div>
                        {game.userProfit !== null ? (
                          <span
                            className={`font-semibold ${getProfitColorClass(game.userProfit)}`}
                          >
                            {game.userProfit > 0 ? "+" : ""}$
                            {game.userProfit.toFixed(2)}
                          </span>
                        ) : game.status === "ACTIVE" ? (
                          <span className="font-medium text-yellow-600 dark:text-yellow-500">
                            Pending
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Not participating
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {mode === "join" ? (
                      <Button
                        disabled={isJoiningId === game.id}
                        onClick={() => onJoinSession?.(game.id)}
                        size="sm"
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        {isJoiningId === game.id ? "Joining..." : "Join Session"}
                      </Button>
                    ) : (
                      <Link href={`/games/${game.id}`}>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
