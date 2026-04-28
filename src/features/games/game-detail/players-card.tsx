"use client";

import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  PiggyBank,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  EditingPlayerTotalsState,
  GamePlayerRow,
  PlayersSortState,
} from "./game-detail-types";

interface PlayersCardProps {
  createdByName?: string | null;
  gamePlayers: GamePlayerRow[];
  isSessionCreator: boolean;
  onEditPlayerTotals: (value: EditingPlayerTotalsState) => void;
}

function getPlayerSortValue(
  gamePlayer: GamePlayerRow,
  key: PlayersSortState["key"]
) {
  if (key === "buyIn") {
    return gamePlayer.buyIn ?? 0;
  }
  if (key === "cashOut") {
    return gamePlayer.cashOut ?? 0;
  }
  return (
    gamePlayer.profit ?? (gamePlayer.cashOut ?? 0) - (gamePlayer.buyIn ?? 0)
  );
}

function getProfit(gamePlayer: GamePlayerRow) {
  return (
    gamePlayer.profit ?? (gamePlayer.cashOut ?? 0) - (gamePlayer.buyIn ?? 0)
  );
}

function getSortIcon(
  isActive: boolean,
  direction: PlayersSortState["direction"]
) {
  if (!isActive) {
    return <ArrowUpDown className="h-3 w-3" />;
  }
  if (direction === "desc") {
    return <ChevronDown className="h-3 w-3" />;
  }
  return <ChevronUp className="h-3 w-3" />;
}

export function PlayersCard({
  createdByName,
  gamePlayers,
  isSessionCreator,
  onEditPlayerTotals,
}: PlayersCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playersSort, setPlayersSort] = useState<PlayersSortState>({
    direction: "desc",
    key: "profit",
  });

  const sortedGamePlayers = [...gamePlayers].sort((left, right) => {
    const leftValue = getPlayerSortValue(left, playersSort.key);
    const rightValue = getPlayerSortValue(right, playersSort.key);

    if (leftValue === rightValue) {
      return (left.player?.name ?? "").localeCompare(right.player?.name ?? "");
    }

    return playersSort.direction === "desc"
      ? rightValue - leftValue
      : leftValue - rightValue;
  });

  function toggleSort(key: PlayersSortState["key"]) {
    setPlayersSort((current) =>
      current.key === key
        ? {
            ...current,
            direction: current.direction === "desc" ? "asc" : "desc",
          }
        : { direction: "desc", key }
    );
  }

  function renderSortableHeader(label: string, key: PlayersSortState["key"]) {
    const isActive = playersSort.key === key;

    return (
      <button
        className="inline-flex items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-wide hover:text-foreground"
        onClick={() => toggleSort(key)}
        type="button"
      >
        <span>{label}</span>
        {getSortIcon(isActive, playersSort.direction)}
      </button>
    );
  }

  function openEditPlayerTotals(gamePlayer: GamePlayerRow) {
    onEditPlayerTotals({
      buyIn: gamePlayer.buyIn.toFixed(2),
      cashOut: (gamePlayer.cashOut ?? 0).toFixed(2),
      playerId: gamePlayer.playerId as Id<"players">,
      playerName: gamePlayer.player?.name ?? "Unknown",
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              {gamePlayers.length}{" "}
              {gamePlayers.length === 1 ? "player" : "players"} in this session
              {createdByName ? (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <PiggyBank className="h-3 w-3" />
                  {createdByName}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <Button
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded((current) => !current)}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {gamePlayers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No players yet</p>
        ) : (
          <ResponsiveTable
            columns={[
              {
                header: "Player",
                key: "player",
                render: (gamePlayer) =>
                  gamePlayer.player?.id ? (
                    <Link
                      className="font-medium transition-colors hover:text-primary hover:underline"
                      href={`/players/${gamePlayer.player.id}`}
                    >
                      {gamePlayer.player?.name}
                    </Link>
                  ) : (
                    gamePlayer.player?.name
                  ),
              },
              {
                header: renderSortableHeader("Buy-In", "buyIn"),
                key: "buyIn",
                render: (gamePlayer) => `$${gamePlayer.buyIn.toFixed(2)}`,
              },
              {
                header: renderSortableHeader("Cash-Out", "cashOut"),
                key: "cashOut",
                render: (gamePlayer) =>
                  gamePlayer.cashOut !== null &&
                  gamePlayer.cashOut !== undefined
                    ? `$${gamePlayer.cashOut.toFixed(2)}`
                    : "--",
              },
              {
                header: renderSortableHeader("Profit", "profit"),
                key: "profit",
                render: (gamePlayer) => {
                  const profit = getProfit(gamePlayer);

                  return (
                    <span
                      className={`font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                    </span>
                  );
                },
              },
              {
                className: "w-10 text-right",
                header: "",
                key: "actions",
                render: (gamePlayer) =>
                  isSessionCreator ? (
                    <Button
                      onClick={() => openEditPlayerTotals(gamePlayer)}
                      size="sm"
                      variant="ghost"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  ) : null,
              },
            ]}
            data={
              isExpanded ? sortedGamePlayers : sortedGamePlayers.slice(0, 3)
            }
            keyExtractor={(gamePlayer) => gamePlayer.id}
            renderCard={(gamePlayer) => {
              const profit = getProfit(gamePlayer);

              return (
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    {gamePlayer.player?.id ? (
                      <Link
                        className="font-medium transition-colors hover:text-primary hover:underline"
                        href={`/players/${gamePlayer.player.id}`}
                      >
                        {gamePlayer.player?.name}
                      </Link>
                    ) : (
                      <div className="font-medium">
                        {gamePlayer.player?.name}
                      </div>
                    )}

                    {isSessionCreator ? (
                      <Button
                        className="h-7 w-7 p-0"
                        onClick={() => openEditPlayerTotals(gamePlayer)}
                        size="sm"
                        variant="ghost"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Buy-In</p>
                      <p className="font-medium">
                        ${gamePlayer.buyIn.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cash-Out</p>
                      <p className="font-medium">
                        {gamePlayer.cashOut !== null &&
                        gamePlayer.cashOut !== undefined
                          ? `$${gamePlayer.cashOut.toFixed(2)}`
                          : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Profit</p>
                      <p
                        className={`font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
