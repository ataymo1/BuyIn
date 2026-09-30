"use client";

import { ArrowUpDown, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  EditingPlayerTotalsState,
  GamePlayerRow,
  PlayersSortState,
} from "./game-detail-types";
import { formatSessionMoney } from "./game-detail-utils";

interface PlayersCardProps {
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

const sortColumns = [
  { key: "buyIn", label: "Buy-in" },
  { key: "cashOut", label: "Cash-out" },
  { key: "profit", label: "Profit" },
] as const;

export function PlayersCard({
  gamePlayers,
  isSessionCreator,
  onEditPlayerTotals,
}: PlayersCardProps) {
  const [playersSort, setPlayersSort] = useState<PlayersSortState>({
    direction: "desc",
    key: "profit",
  });
  const sortedGamePlayers = [...gamePlayers].sort((left, right) => {
    const difference =
      getPlayerSortValue(left, playersSort.key) -
      getPlayerSortValue(right, playersSort.key);
    if (difference === 0) {
      return (left.player?.name ?? "").localeCompare(right.player?.name ?? "");
    }
    return playersSort.direction === "desc" ? -difference : difference;
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

  return (
    <div className="space-y-5 pt-5">
      <p className="text-muted-foreground text-sm">
        Buy-ins, cash-outs, and net results by player
      </p>
      {gamePlayers.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          No players yet
        </p>
      ) : (
        <Table aria-label="Player ledger" className="text-xs sm:text-sm">
          <TableHeader className="bg-muted/40">
            <TableRow className="grid grid-cols-3 sm:table-row">
              <TableHead className="hidden w-1/3 px-2 sm:table-cell sm:px-4">
                Player
              </TableHead>
              {sortColumns.map(({ key, label }) => {
                const active = playersSort.key === key;
                const DirectionIcon =
                  playersSort.direction === "desc" ? ChevronDown : ChevronUp;
                const SortIcon = active ? DirectionIcon : ArrowUpDown;
                const direction =
                  playersSort.direction === "desc" ? "descending" : "ascending";
                return (
                  <TableHead
                    aria-sort={active ? direction : undefined}
                    className="flex h-auto items-center px-2 py-2 sm:table-cell sm:px-4 sm:text-right"
                    key={key}
                  >
                    <button
                      className="inline-flex items-center justify-end gap-1 whitespace-nowrap py-2 hover:text-foreground"
                      onClick={() => toggleSort(key)}
                      type="button"
                    >
                      {label}
                      <SortIcon aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                );
              })}
              {isSessionCreator ? (
                <TableHead className="hidden w-10 px-1 sm:table-cell">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGamePlayers.map((gamePlayer) => {
              const name = gamePlayer.player?.name ?? "Unknown";
              const profit = getPlayerSortValue(gamePlayer, "profit");
              return (
                <TableRow
                  className="grid grid-cols-3 sm:table-row"
                  key={gamePlayer.id}
                >
                  <TableCell className="col-span-2 row-start-1 px-2 pt-4 pb-1 sm:px-4 sm:py-5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground text-xs sm:inline-flex"
                      >
                        {name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      {gamePlayer.player?.id ? (
                        <Link
                          className="break-words font-medium hover:underline"
                          href={`/players/${gamePlayer.player.id}`}
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="break-words font-medium">{name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="row-start-2 whitespace-nowrap px-2 pt-1 pb-4 tabular-nums sm:px-4 sm:py-4 sm:text-right">
                    {formatSessionMoney(gamePlayer.buyIn)}
                  </TableCell>
                  <TableCell className="row-start-2 whitespace-nowrap px-2 pt-1 pb-4 tabular-nums sm:px-4 sm:py-4 sm:text-right">
                    {gamePlayer.cashOut == null
                      ? "—"
                      : formatSessionMoney(gamePlayer.cashOut)}
                  </TableCell>
                  <TableCell
                    className={`row-start-2 whitespace-nowrap px-2 pt-1 pb-4 font-medium tabular-nums sm:px-4 sm:py-4 sm:text-right ${profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {profit >= 0 ? "+" : ""}
                    {formatSessionMoney(profit)}
                  </TableCell>
                  {isSessionCreator ? (
                    <TableCell className="col-start-3 row-start-1 px-1 py-1 text-right sm:py-4">
                      <Button
                        aria-label={`Edit totals for ${name}`}
                        className="h-9 w-9"
                        onClick={() =>
                          onEditPlayerTotals({
                            buyIn: gamePlayer.buyIn.toFixed(2),
                            cashOut: (gamePlayer.cashOut ?? 0).toFixed(2),
                            playerId: gamePlayer.playerId as Id<"players">,
                            playerName: name,
                          })
                        }
                        size="icon"
                        variant="ghost"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
