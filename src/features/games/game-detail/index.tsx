"use client";

import { useNotification } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";
import { useConvexUser, usePlayer } from "@/lib/convex-hooks";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GameDetailDialogs } from "./game-detail-dialogs";
import { GameDetailSkeleton } from "./game-detail-skeleton";
import type {
  EditingPlayerTotalsState,
  EditingTransactionState,
  GamePlayerRow,
  GameTransactionRow,
} from "./game-detail-types";
import { PendingTransactionsCard } from "./pending-transactions-card";
import { PlayersCard } from "./players-card";
import { SessionActionsCard } from "./session-actions-card";
import { SessionHeader } from "./session-header";
import { TransactionsCard } from "./transactions-card";

interface GameDetailClientProps {
  gameId: string;
}

export function GameDetailClient({ gameId }: GameDetailClientProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const { userId, user, isLoading: userLoading } = useConvexUser();
  const { player, isLoading: playerLoading } = usePlayer();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBuyInDialog, setShowBuyInDialog] = useState(false);
  const [initialBuyInAmount, setInitialBuyInAmount] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "COMPLETED">(
    "ACTIVE"
  );
  const [editGameType, setEditGameType] = useState<"cash" | "tournament">(
    "cash"
  );
  const [editingTransaction, setEditingTransaction] =
    useState<EditingTransactionState | null>(null);
  const [editingPlayerTotals, setEditingPlayerTotals] =
    useState<EditingPlayerTotalsState | null>(null);
  const [isUpdatingPlayerTotals, setIsUpdatingPlayerTotals] = useState(false);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);
  const [isDeletingTxId, setIsDeletingTxId] = useState<string | null>(null);

  const game = useQuery(api.games.getGame, { gameId: gameId as Id<"games"> });
  const transactions = useQuery(api.transactions.getTransactions, {
    gameId: gameId as Id<"games">,
  });
  const canManage = useQuery(
    api.games.canManageGame,
    userId ? { gameId: gameId as Id<"games">, userId } : "skip"
  );
  const isSessionCreator = useQuery(
    api.transactions.isSessionCreator,
    userId ? { gameId: gameId as Id<"games">, userId } : "skip"
  );
  const pendingBuyIns = useQuery(
    api.transactions.getPendingBuyIns,
    userId && isSessionCreator
      ? { gameId: gameId as Id<"games">, userId }
      : "skip"
  );

  const createTransaction = useMutation(api.transactions.createTransaction);
  const approveTransaction = useMutation(api.transactions.approveTransaction);
  const rejectTransaction = useMutation(api.transactions.rejectTransaction);
  const updateTransaction = useMutation(api.transactions.updateTransaction);
  const deleteTransactionMutation = useMutation(api.transactions.deleteTransaction);
  const setPlayerTotals = useMutation(api.transactions.setPlayerTotals);
  const joinGame = useMutation(api.games.joinGame);
  const updateGame = useMutation(api.games.updateGame);
  const updateGameStatus = useMutation(api.games.updateGameStatus);
  const deleteGame = useMutation(api.games.deleteGame);

  const isLoading = userLoading || playerLoading || game === undefined;

  function openEditDialog() {
    if (!game) return;

    setEditLocation(game.location ?? "");
    setEditDate(format(new Date(game.date), "yyyy-MM-dd"));
    setEditStatus(game.status === "COMPLETED" ? "COMPLETED" : "ACTIVE");
    setEditGameType(game.gameType ?? "cash");
    setShowEditDialog(true);
  }

  async function handleSaveEdit() {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      await updateGame({
        date: new Date(editDate).getTime(),
        gameId: gameId as Id<"games">,
        gameType: editGameType,
        location: editLocation || undefined,
        userId,
      });

      if (game && editStatus !== game.status) {
        await updateGameStatus({
          gameId: gameId as Id<"games">,
          status: editStatus,
          userId,
        });
      }

      setShowEditDialog(false);
    } catch (error) {
      console.error("Failed to update session:", error);
      showNotification("Failed to update session. Please try again.", {
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      await deleteGame({
        gameId: gameId as Id<"games">,
        userId,
      });
      router.push("/sessions");
    } catch (error) {
      console.error("Failed to delete session:", error);
      showNotification("Failed to delete session. Please try again.", {
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: "ACTIVE" | "COMPLETED") {
    if (!userId) return;

    try {
      await updateGameStatus({
        gameId: gameId as Id<"games">,
        status: newStatus,
        userId,
      });
    } catch (error) {
      console.error("Failed to update status:", error);
      showNotification("Failed to update status. Please try again.", {
        type: "error",
      });
    }
  }

  function handleJoinClick() {
    const hasPaymentInfo = user?.venmo?.trim() || user?.zelle?.trim();

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
    if (!(player?._id && userId)) {
      console.error("[handleJoinGame] No player record - waiting for player sync");
      showNotification("Please wait, setting up your player profile...", {
        type: "info",
      });
      return;
    }

    setIsJoining(true);
    try {
      const buyInValue = parseFloat(initialBuyInAmount) || 0;

      await joinGame({
        gameId: gameId as Id<"games">,
        playerId: player._id,
      });

      if (buyInValue > 0) {
        const result = await createTransaction({
          amount: buyInValue,
          createdById: userId,
          description: "Initial buy-in",
          gameId: gameId as Id<"games">,
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
    } catch (error) {
      console.error("[handleJoinGame] Error joining game:", error);
      showNotification("Failed to join session. Please try again.", {
        type: "error",
      });
    } finally {
      setIsJoining(false);
    }
  }

  async function handleCreateTransaction(
    type: "buyin" | "cashout",
    amount: number,
    description?: string
  ) {
    if (!(player?._id && userId)) return;

    const result = await createTransaction({
      amount,
      createdById: userId,
      description,
      gameId: gameId as Id<"games">,
      playerId: player._id,
      type,
    });

    if (result.status === "PENDING") {
      const transactionType = type === "buyin" ? "buy-in" : "cash-out";
      showNotification(
        `Your ${transactionType} request has been submitted and is awaiting approval from the session host.`,
        { title: "Request Submitted", type: "success" }
      );
    }
  }

  async function handleApproveTransaction(transactionId: Id<"transactions">) {
    if (!userId) return;

    setIsApprovingId(transactionId);
    try {
      await approveTransaction({ transactionId, userId });
    } catch (error) {
      console.error("Failed to approve transaction:", error);
      showNotification("Failed to approve transaction. Please try again.", {
        type: "error",
      });
    } finally {
      setIsApprovingId(null);
    }
  }

  async function handleRejectTransaction(transactionId: Id<"transactions">) {
    if (!userId) return;

    setIsRejectingId(transactionId);
    try {
      await rejectTransaction({ transactionId, userId });
    } catch (error) {
      console.error("Failed to reject transaction:", error);
      showNotification("Failed to reject transaction. Please try again.", {
        type: "error",
      });
    } finally {
      setIsRejectingId(null);
    }
  }

  async function handleUpdateTransaction() {
    if (!(userId && editingTransaction)) return;

    setIsSubmitting(true);
    try {
      await updateTransaction({
        amount: Number(editingTransaction.amount),
        transactionId: editingTransaction.id,
        userId,
      });
      setEditingTransaction(null);
    } catch (error) {
      console.error("Failed to update transaction:", error);
      showNotification("Failed to update transaction. Please try again.", {
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePlayerTotals() {
    if (!(userId && editingPlayerTotals)) return;

    setIsUpdatingPlayerTotals(true);
    try {
      await setPlayerTotals({
        buyIn: Number(editingPlayerTotals.buyIn),
        cashOut: Number(editingPlayerTotals.cashOut),
        gameId: gameId as Id<"games">,
        playerId: editingPlayerTotals.playerId,
        userId,
      });
      setEditingPlayerTotals(null);
    } catch (error) {
      console.error("Failed to update player totals:", error);
      showNotification("Failed to update player totals. Please try again.", {
        type: "error",
      });
    } finally {
      setIsUpdatingPlayerTotals(false);
    }
  }

  async function handleDeleteTransaction(transactionId: Id<"transactions">) {
    if (!userId) return;
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    setIsDeletingTxId(transactionId);
    try {
      await deleteTransactionMutation({ transactionId, userId });
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      showNotification("Failed to delete transaction. Please try again.", {
        type: "error",
      });
    } finally {
      setIsDeletingTxId(null);
    }
  }

  if (isLoading) {
    return <GameDetailSkeleton />;
  }

  if (!game) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Game not found</p>
        <Link href="/sessions">
          <Button className="mt-4" variant="outline">
            Back to Sessions
          </Button>
        </Link>
      </div>
    );
  }

  const userGamePlayer = game.gamePlayers?.find(
    (gamePlayer) => gamePlayer.playerId === player?._id
  );
  const isJoined = Boolean(userGamePlayer);
  const gamePlayers = (game.gamePlayers ?? []) as GamePlayerRow[];
  const finalizedTransactions = ((transactions ?? []).filter(
    (transaction) =>
      transaction.status !== "PENDING" && transaction.status !== "REJECTED"
  ) ?? []) as GameTransactionRow[];
  const pendingTransactions = (pendingBuyIns ?? []) as GameTransactionRow[];

  return (
    <div className="space-y-8">
      <SessionHeader
        canManage={Boolean(canManage)}
        createdByName={game.createdBy?.name}
        date={game.date}
        gameType={game.gameType ?? "cash"}
        group={
          game.group
            ? {
                id: game.group.id,
                name: game.group.name,
              }
            : null
        }
        isJoined={isJoined}
        isSessionCreator={Boolean(isSessionCreator)}
        location={game.location}
        onDeleteClick={() => setShowDeleteDialog(true)}
        onEditClick={openEditDialog}
        onJoinClick={handleJoinClick}
        onStatusChange={handleStatusChange}
        status={game.status}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PlayersCard
          createdByName={game.createdBy?.name}
          gamePlayers={gamePlayers}
          isSessionCreator={Boolean(isSessionCreator)}
          onEditPlayerTotals={setEditingPlayerTotals}
        />
        <TransactionsCard
          isDeletingTxId={isDeletingTxId}
          isSessionCreator={Boolean(isSessionCreator)}
          onDeleteTransaction={handleDeleteTransaction}
          onEditTransaction={setEditingTransaction}
          transactions={finalizedTransactions}
        />
      </div>

      {isSessionCreator ? (
        <PendingTransactionsCard
          isApprovingId={isApprovingId}
          isRejectingId={isRejectingId}
          onApprove={handleApproveTransaction}
          onReject={handleRejectTransaction}
          pendingTransactions={pendingTransactions}
        />
      ) : null}

      {game.status === "ACTIVE" && isJoined ? (
        <SessionActionsCard onSubmitTransaction={handleCreateTransaction} />
      ) : null}

      <GameDetailDialogs
        editDate={editDate}
        editGameType={editGameType}
        editLocation={editLocation}
        editStatus={editStatus}
        editingPlayerTotals={editingPlayerTotals}
        editingTransaction={editingTransaction}
        initialBuyInAmount={initialBuyInAmount}
        isJoining={isJoining}
        isSubmitting={isSubmitting}
        isUpdatingPlayerTotals={isUpdatingPlayerTotals}
        onBuyInAmountChange={setInitialBuyInAmount}
        onCloseBuyInDialog={() => setShowBuyInDialog(false)}
        onDelete={handleDelete}
        onDeleteDialogChange={setShowDeleteDialog}
        onEditDateChange={setEditDate}
        onEditDialogChange={setShowEditDialog}
        onEditGameTypeChange={setEditGameType}
        onEditLocationChange={setEditLocation}
        onEditStatusChange={setEditStatus}
        onEditingPlayerTotalsChange={setEditingPlayerTotals}
        onEditingTransactionChange={setEditingTransaction}
        onJoin={handleJoinWithBuyIn}
        onPaymentSuccess={handlePaymentSuccess}
        onSaveEdit={handleSaveEdit}
        onShowBuyInDialogChange={setShowBuyInDialog}
        onShowPaymentModalChange={setShowPaymentModal}
        onUpdatePlayerTotals={handleUpdatePlayerTotals}
        onUpdateTransaction={handleUpdateTransaction}
        showBuyInDialog={showBuyInDialog}
        showDeleteDialog={showDeleteDialog}
        showEditDialog={showEditDialog}
        showPaymentModal={showPaymentModal}
      />
    </div>
  );
}
