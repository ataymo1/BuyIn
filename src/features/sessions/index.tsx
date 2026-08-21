"use client";

import { useMutation } from "convex/react";
import { History, LogIn } from "lucide-react";
import { useState } from "react";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { useNotification } from "@/components/providers/notification-provider";
import { Card, CardContent } from "@/components/ui/card";
import {
  useConvexUser,
  useGames,
  useJoinGame,
  usePlayer,
} from "@/lib/convex-hooks";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { JoinSessionDialog } from "./join-session-dialog";
import { SessionListSection } from "./session-list-section";
import { SessionsSkeleton } from "./sessions-skeleton";
import type { SessionListItem } from "./types";

export function SessionsClient() {
  const { player, isLoading: playerLoading } = usePlayer();
  const { userId, user } = useConvexUser();
  const { showNotification } = useNotification();
  const joinGame = useJoinGame();
  const createTransaction = useMutation(api.transactions.createTransaction);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingJoinGameId, setPendingJoinGameId] = useState<string | null>(
    null
  );
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [showBuyInDialog, setShowBuyInDialog] = useState(false);
  const [initialBuyInAmount, setInitialBuyInAmount] = useState("");

  const { games, isLoading: gamesLoading } = useGames({});

  if (playerLoading || gamesLoading) {
    return <SessionsSkeleton />;
  }

  const gamesList = games ?? [];
  const gamesWithUserProfit: SessionListItem[] = gamesList.map((game) => {
    let userProfit: number | null = null;
    let isParticipant = false;

    if (player) {
      const userGamePlayer = game.gamePlayers?.find(
        (gamePlayer) => gamePlayer.playerId === player._id
      );

      if (userGamePlayer) {
        isParticipant = true;

        if (game.status === "COMPLETED") {
          const buyIn = userGamePlayer.buyIn ?? 0;
          const cashOut = userGamePlayer.cashOut ?? 0;
          userProfit = cashOut - buyIn;
        }
      }
    }

    return { ...game, isParticipant, userProfit };
  });

  const sessionsToJoin = gamesWithUserProfit.filter(
    (game) => game.status === "ACTIVE" && !game.isParticipant
  );
  const userSessions = gamesWithUserProfit.filter((game) => game.isParticipant);

  function handleJoinSession(gameId: string) {
    if (!player?._id) {
      showNotification("Please wait, setting up your player profile...", {
        type: "info",
      });
      return;
    }

    const hasPaymentInfo = user?.venmo?.trim() || user?.zelle?.trim();

    setPendingJoinGameId(gameId);

    if (hasPaymentInfo) {
      setInitialBuyInAmount("");
      setShowBuyInDialog(true);
      return;
    }

    setShowPaymentModal(true);
  }

  function handlePaymentSuccess() {
    setShowPaymentModal(false);
    setInitialBuyInAmount("");
    setShowBuyInDialog(true);
  }

  async function handleJoinWithBuyIn() {
    if (!(player?._id && userId && pendingJoinGameId)) {
      return;
    }

    setIsJoining(pendingJoinGameId);

    try {
      const buyInValue = Number.parseFloat(initialBuyInAmount) || 0;

      await joinGame({
        gameId: pendingJoinGameId as Id<"games">,
        playerId: player._id,
        userId,
      });

      if (buyInValue > 0) {
        const result = await createTransaction({
          amount: buyInValue,
          createdById: userId,
          description: "Initial buy-in",
          gameId: pendingJoinGameId as Id<"games">,
          playerId: player._id,
          type: "buyin",
        });

        if (result.status === "PENDING") {
          showNotification(
            "You've joined the session! Your initial buy-in request has been submitted and is awaiting approval from the session host.",
            { title: "Request Submitted", type: "success" }
          );
        }
      }

      setShowBuyInDialog(false);
      setInitialBuyInAmount("");
      setPendingJoinGameId(null);
      window.location.reload();
    } catch (error) {
      console.error("Error joining session:", error);
      showNotification("Failed to join session. Please try again.", {
        type: "error",
      });
    } finally {
      setIsJoining(null);
    }
  }

  return (
    <div className="space-y-8">
      {sessionsToJoin.length > 0 ? (
        <SessionListSection
          games={sessionsToJoin}
          icon={LogIn}
          iconClassName="text-green-600 dark:text-green-400"
          isJoiningId={isJoining}
          mode="join"
          onJoinSession={handleJoinSession}
          title="Sessions to Join"
          userId={userId}
        />
      ) : null}

      {userSessions.length > 0 ? (
        <SessionListSection
          games={userSessions}
          icon={History}
          iconClassName="text-blue-600 dark:text-blue-400"
          mode="view"
          title="Your Sessions"
          userId={userId}
        />
      ) : null}

      {sessionsToJoin.length === 0 && userSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">No sessions found.</p>
            <p className="text-muted-foreground text-sm">
              Sessions are created from group pages. Visit a group to create a
              new session.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <PaymentInfoModal
        onSuccess={handlePaymentSuccess}
        open={showPaymentModal}
      />

      <JoinSessionDialog
        amount={initialBuyInAmount}
        isJoining={isJoining !== null}
        onAmountChange={setInitialBuyInAmount}
        onClose={() => {
          setShowBuyInDialog(false);
          setPendingJoinGameId(null);
        }}
        onSubmit={handleJoinWithBuyIn}
        open={showBuyInDialog}
      />
    </div>
  );
}
