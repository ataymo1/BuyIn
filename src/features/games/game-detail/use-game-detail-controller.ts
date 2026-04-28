"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotification } from "@/components/providers/notification-provider";
import { useConvexUser, usePlayer } from "@/lib/convex-hooks";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  EditingPlayerTotalsState,
  EditingTransactionState,
  GamePlayerRow,
  GameTransactionRow,
} from "./game-detail-types";

export function useGameDetailController(gameId: string) {
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
  const deleteTransactionMutation = useMutation(
    api.transactions.deleteTransaction
  );
  const setPlayerTotals = useMutation(api.transactions.setPlayerTotals);
  const joinGame = useMutation(api.games.joinGame);
  const updateGame = useMutation(api.games.updateGame);
  const updateGameStatus = useMutation(api.games.updateGameStatus);
  const deleteGame = useMutation(api.games.deleteGame);

  const isLoading = userLoading || playerLoading || game === undefined;
  const userGamePlayer = game?.gamePlayers?.find(
    (gamePlayer) => gamePlayer.playerId === player?._id
  );
  const isJoined = Boolean(userGamePlayer);
  const gamePlayers = (game?.gamePlayers ?? []) as GamePlayerRow[];
  const finalizedTransactions = ((transactions ?? []).filter(
    (transaction) =>
      transaction.status !== "PENDING" && transaction.status !== "REJECTED"
  ) ?? []) as GameTransactionRow[];
  const pendingTransactions = (pendingBuyIns ?? []) as GameTransactionRow[];

  function openEditDialog() {
    if (!game) {
      return;
    }

    setEditLocation(game.location ?? "");
    setEditDate(format(new Date(game.date), "yyyy-MM-dd"));
    setEditStatus(game.status === "COMPLETED" ? "COMPLETED" : "ACTIVE");
    setEditGameType(game.gameType ?? "cash");
    setShowEditDialog(true);
  }

  async function handleSaveEdit() {
    if (!userId) {
      return;
    }

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
    if (!userId) {
      return;
    }

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
    if (!userId) {
      return;
    }

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
      console.error(
        "[handleJoinGame] No player record - waiting for player sync"
      );
      showNotification("Please wait, setting up your player profile...", {
        type: "info",
      });
      return;
    }

    setIsJoining(true);
    try {
      const buyInValue = Number.parseFloat(initialBuyInAmount) || 0;

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
    if (!(player?._id && userId)) {
      return;
    }

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
    if (!userId) {
      return;
    }

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
    if (!userId) {
      return;
    }

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
    if (!(userId && editingTransaction)) {
      return;
    }

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
    if (!(userId && editingPlayerTotals)) {
      return;
    }

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
    if (!userId) {
      return;
    }

    // biome-ignore lint/suspicious/noAlert: This legacy inline confirmation preserves the existing delete flow.
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

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

  return {
    canManage: Boolean(canManage),
    dialogs: {
      editDate,
      editGameType,
      editingPlayerTotals,
      editingTransaction,
      editLocation,
      editStatus,
      initialBuyInAmount,
      isJoining,
      isSubmitting,
      isUpdatingPlayerTotals,
      onBuyInAmountChange: setInitialBuyInAmount,
      onCloseBuyInDialog: () => setShowBuyInDialog(false),
      onDelete: handleDelete,
      onDeleteDialogChange: setShowDeleteDialog,
      onEditDateChange: setEditDate,
      onEditDialogChange: setShowEditDialog,
      onEditGameTypeChange: setEditGameType,
      onEditingPlayerTotalsChange: setEditingPlayerTotals,
      onEditingTransactionChange: setEditingTransaction,
      onEditLocationChange: setEditLocation,
      onEditStatusChange: setEditStatus,
      onJoin: handleJoinWithBuyIn,
      onPaymentSuccess: handlePaymentSuccess,
      onSaveEdit: handleSaveEdit,
      onShowBuyInDialogChange: setShowBuyInDialog,
      onUpdatePlayerTotals: handleUpdatePlayerTotals,
      onUpdateTransaction: handleUpdateTransaction,
      showBuyInDialog,
      showDeleteDialog,
      showEditDialog,
      showPaymentModal,
    },
    finalizedTransactions,
    game,
    gamePlayers,
    isDeletingTxId,
    isJoined,
    isLoading,
    isSessionCreator: Boolean(isSessionCreator),
    onApproveTransaction: handleApproveTransaction,
    onDeleteClick: () => setShowDeleteDialog(true),
    onDeleteTransaction: handleDeleteTransaction,
    onEditPlayerTotals: setEditingPlayerTotals,
    onEditTransaction: setEditingTransaction,
    onJoinClick: handleJoinClick,
    onRejectTransaction: handleRejectTransaction,
    onStatusChange: handleStatusChange,
    onSubmitTransaction: handleCreateTransaction,
    openEditDialog,
    pendingTransactions,
    transactionApprovalState: {
      isApprovingId,
      isRejectingId,
    },
  };
}
