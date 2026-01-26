"use client";

import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent
} from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { MobileCardSkeleton, Skeleton, TableRowSkeleton } from "@/components/ui/skeleton";
import {
    useConvexUser,
    useGames,
    useJoinGame,
    usePlayer,
} from "@/lib/convex-hooks";
import { format } from "date-fns";
import {
    Banknote,
    Calendar,
    History,
    LogIn,
    MapPin,
    Users
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

function SessionsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Sessions to Join Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Card>
          <CardContent className="p-0">
            {/* Desktop table skeleton */}
            <div className="hidden md:block">
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={5} />
              ))}
            </div>
            {/* Mobile card skeleton */}
            <div className="space-y-4 p-4 md:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <MobileCardSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Sessions Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Card>
          <CardContent className="p-0">
            {/* Desktop table skeleton */}
            <div className="hidden md:block">
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={6} />
              ))}
            </div>
            {/* Mobile card skeleton */}
            <div className="space-y-4 p-4 md:hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <MobileCardSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SessionsClient() {
  const { player, isLoading: playerLoading } = usePlayer();
  const { userId, user } = useConvexUser();
  const joinGame = useJoinGame();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingJoinGameId, setPendingJoinGameId] = useState<string | null>(
    null
  );
  const [isJoining, setIsJoining] = useState<string | null>(null);

  const { games, isLoading: gamesLoading } = useGames({});

  const isLoading = playerLoading || gamesLoading;

  if (isLoading) {
    return <SessionsSkeleton />;
  }

  const gamesList = games ?? [];

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

  // Split games into: sessions to join (active and not joined), and user's sessions (all sessions user is part of)
  const sessionsToJoin = gamesWithUserProfit.filter(
    (game) => game.status === "ACTIVE" && !game.isParticipant
  );
  const userSessions = gamesWithUserProfit.filter(
    (game) => game.isParticipant
  );

  const handleJoinSession = async (gameId: string) => {
    if (!player?._id) {
      alert("Please wait, setting up your player profile...");
      return;
    }

    // Check if user has payment info
    const hasPaymentInfo = user?.venmo?.trim() || user?.zelle?.trim();

    if (hasPaymentInfo) {
      // User has payment info, join directly
      await performJoinGame(gameId);
    } else {
      // User needs to add payment info first
      setPendingJoinGameId(gameId);
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    if (pendingJoinGameId) {
      await performJoinGame(pendingJoinGameId);
      setPendingJoinGameId(null);
    }
  };

  const performJoinGame = async (gameId: string) => {
    if (!player?._id) {
      return;
    }

    setIsJoining(gameId);
    try {
      await joinGame({
        gameId: gameId as Id<"games">,
        playerId: player._id,
      });
      // Refresh the page to update the session lists
      window.location.reload();
    } catch (error) {
      console.error("Error joining session:", error);
      alert("Failed to join session. Please try again.");
    } finally {
      setIsJoining(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Sessions to Join */}
      {sessionsToJoin.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-xl flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-600" />
              Sessions to Join
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <ResponsiveTable
                data={sessionsToJoin}
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
                    key: "players",
                    header: "Players",
                    render: (game) => game.gamePlayers?.length ?? 0,
                  },
                  {
                    key: "banker",
                    header: "Banker",
                    render: (game) => {
                      const isBanker = game.createdBy?.id === userId;
                      return isBanker ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          <Banknote className="h-3 w-3" />
                          You
                        </span>
                      ) : game.createdBy ? (
                        <span className="text-muted-foreground text-sm">
                          {game.createdBy.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      );
                    },
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (game) => (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleJoinSession(game.id)}
                        disabled={isJoining === game.id}
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        {isJoining === game.id ? "Joining..." : "Join Session"}
                      </Button>
                    ),
                  },
                ]}
                renderCard={(game) => {
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
                          {isBanker && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              <Banknote className="h-3 w-3" />
                              Banker
                            </span>
                          )}
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

                    <div className="flex items-center justify-end">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleJoinSession(game.id)}
                        disabled={isJoining === game.id}
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        {isJoining === game.id ? "Joining..." : "Join Session"}
                      </Button>
                    </div>
                  </div>
                  );
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* User's Sessions */}
      {userSessions.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-xl flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Your Sessions
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <ResponsiveTable
                data={userSessions}
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
                      ) : game.status === "ACTIVE" ? (
                        <span className="font-medium text-yellow-600 dark:text-yellow-500">
                          Pending
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      ),
                  },
                  {
                    key: "banker",
                    header: "Banker",
                    render: (game) => {
                      const isBanker = game.createdBy?.id === userId;
                      return isBanker ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          <Banknote className="h-3 w-3" />
                          You
                        </span>
                      ) : game.createdBy ? (
                        <span className="text-muted-foreground text-sm">
                          {game.createdBy.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      );
                    },
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
                renderCard={(game) => {
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
                            {isBanker && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                <Banknote className="h-3 w-3" />
                                Banker
                              </span>
                            )}
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
                        <Link href={`/games/${game.id}`}>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {sessionsToJoin.length === 0 && userSessions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No sessions found.
            </p>
            <p className="text-muted-foreground text-sm">
              Sessions are created from group pages. Visit a group to create a
              new session.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment Info Modal */}
      <PaymentInfoModal
        open={showPaymentModal}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
