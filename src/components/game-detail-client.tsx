"use client";

import { useNotification } from "@/components/notification-provider";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton, TableRowSkeleton } from "@/components/ui/skeleton";
import { useConvexUser, usePlayer } from "@/lib/convex-hooks";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowUpDown,
  Banknote,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  HandCoins,
  Loader2,
  MoreVertical,
  Pencil,
  PiggyBank,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function GameDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Players and Transactions Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          </CardHeader>
          <CardContent>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={4} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface GameDetailClientProps {
  gameId: string;
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

export function GameDetailClient({ gameId }: GameDetailClientProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const { userId, user, isLoading: userLoading } = useConvexUser();
  const { player, isLoading: playerLoading } = usePlayer();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Initial buy-in dialog state
  const [showBuyInDialog, setShowBuyInDialog] = useState(false);
  const [initialBuyInAmount, setInitialBuyInAmount] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Transaction form state
  const [activeAction, setActiveAction] = useState<"buyin" | "cashout" | null>(null);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);

  // Collapsible sections state (default to collapsed)
  const [isPlayersExpanded, setIsPlayersExpanded] = useState(false);
  const [isTransactionsExpanded, setIsTransactionsExpanded] = useState(false);
  const [isPendingExpanded, setIsPendingExpanded] = useState(false);
  const [playersSort, setPlayersSort] = useState<{
    key: "buyIn" | "cashOut" | "profit";
    direction: "asc" | "desc";
  }>({ key: "profit", direction: "desc" });

  // Edit form state
  const [editLocation, setEditLocation] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "COMPLETED">(
    "ACTIVE"
  );

  // Transaction edit state
  const [editingTransaction, setEditingTransaction] = useState<{
    id: Id<"transactions">;
    amount: string;
    type: string;
    playerName: string;
  } | null>(null);
  const [editingPlayerTotals, setEditingPlayerTotals] = useState<{
    playerId: Id<"players">;
    playerName: string;
    buyIn: string;
    cashOut: string;
  } | null>(null);
  const [isUpdatingPlayerTotals, setIsUpdatingPlayerTotals] = useState(false);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);
  const [isDeletingTxId, setIsDeletingTxId] = useState<string | null>(null);

  const game = useQuery(api.games.getGame, { gameId: gameId as Id<"games"> });

  const transactions = useQuery(api.transactions.getTransactions, {
    gameId: gameId as Id<"games">,
  });

  // Check if user can manage this game (is group owner)
  const canManage = useQuery(
    api.games.canManageGame,
    userId ? { gameId: gameId as Id<"games">, userId } : "skip"
  );

  // Check if user is the session creator
  const isSessionCreator = useQuery(
    api.transactions.isSessionCreator,
    userId ? { gameId: gameId as Id<"games">, userId } : "skip"
  );

  // Get pending buy-in requests (only for session creator)
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

  // Open edit dialog and populate form
  function openEditDialog() {
    if (game) {
      setEditLocation(game.location ?? "");
      setEditDate(format(new Date(game.date), "yyyy-MM-dd"));
      setEditStatus(game.status === "CANCELLED" ? "ACTIVE" : game.status);
      setShowEditDialog(true);
      setShowActionsMenu(false);
    }
  }

  async function handleSaveEdit() {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      // Update game details
      await updateGame({
        gameId: gameId as Id<"games">,
        userId,
        location: editLocation || undefined,
        date: new Date(editDate).getTime(),
      });

      // Update status if changed
      if (game && editStatus !== game.status) {
        await updateGameStatus({
          gameId: gameId as Id<"games">,
          userId,
          status: editStatus,
        });
      }

      setShowEditDialog(false);
    } catch (error) {
      console.error("Failed to update session:", error);
      showNotification("Failed to update session. Please try again.", { type: "error" });
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
      showNotification("Failed to delete session. Please try again.", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: "ACTIVE" | "COMPLETED") {
    if (!userId) return;

    try {
      await updateGameStatus({
        gameId: gameId as Id<"games">,
        userId,
        status: newStatus,
      });
      setShowActionsMenu(false);
    } catch (error) {
      console.error("Failed to update status:", error);
      showNotification("Failed to update status. Please try again.", { type: "error" });
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

  // Check if user has joined this session
  const userGamePlayer = game.gamePlayers?.find(
    (gp) => gp.playerId === player?._id
  );
  const isJoined = !!userGamePlayer;
  const playersCount = game.gamePlayers?.length ?? 0;
  const finalizedTransactions = (transactions ?? []).filter(
    (tx) => tx.status !== "PENDING" && tx.status !== "REJECTED"
  );
  const totalBoughtIn = finalizedTransactions.reduce(
    (sum, tx) => (tx.type === "buyin" ? sum + tx.amount : sum),
    0
  );
  const totalCashedOut = finalizedTransactions.reduce(
    (sum, tx) => (tx.type === "cashout" ? sum + tx.amount : sum),
    0
  );
  const bankerLoss = Math.max(0, totalCashedOut - totalBoughtIn);

  type GamePlayer = NonNullable<typeof game.gamePlayers>[number];

  function getPlayerSortValue(
    gp: GamePlayer,
    key: "buyIn" | "cashOut" | "profit"
  ) {
    if (key === "buyIn") return gp.buyIn ?? 0;
    if (key === "cashOut") return gp.cashOut ?? 0;
    return gp.profit ?? (gp.cashOut ?? 0) - (gp.buyIn ?? 0);
  }

  const sortedGamePlayers = [...(game.gamePlayers ?? [])].sort((a, b) => {
    const aValue = getPlayerSortValue(a, playersSort.key);
    const bValue = getPlayerSortValue(b, playersSort.key);
    if (aValue === bValue) {
      return (a.player?.name ?? "").localeCompare(b.player?.name ?? "");
    }
    return playersSort.direction === "desc"
      ? bValue - aValue
      : aValue - bValue;
  });

  function togglePlayersSort(key: "buyIn" | "cashOut" | "profit") {
    setPlayersSort((current) =>
      current.key === key
        ? {
            ...current,
            direction: current.direction === "desc" ? "asc" : "desc",
          }
        : { key, direction: "desc" }
    );
  }

  function renderSortableHeader(
    label: string,
    key: "buyIn" | "cashOut" | "profit"
  ) {
    const isActive = playersSort.key === key;
    return (
      <button
        type="button"
        onClick={() => togglePlayersSort(key)}
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span>{label}</span>
        {isActive ? (
          playersSort.direction === "desc" ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronUp className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </button>
    );
  }

  function handleJoinClick() {
    // Check if user has payment info (venmo or zelle)
    const hasPaymentInfo = user?.venmo?.trim() || user?.zelle?.trim();

    if (hasPaymentInfo) {
      // User already has payment info, show buy-in dialog
      setInitialBuyInAmount("");
      setShowBuyInDialog(true);
    } else {
      // User needs to add payment info first
      setShowPaymentModal(true);
    }
  }

  async function handlePaymentSuccess() {
    setShowPaymentModal(false);
    // After adding payment info, show the buy-in dialog
    setInitialBuyInAmount("");
    setShowBuyInDialog(true);
  }

  async function handleJoinWithBuyIn() {
    if (!player?._id || !userId) {
      console.error(
        "[handleJoinGame] No player record - waiting for player sync"
      );
      showNotification("Please wait, setting up your player profile...", { type: "info" });
      return;
    }
    
    setIsJoining(true);
    try {
      const buyInValue = parseFloat(initialBuyInAmount) || 0;
      
      // First, join the game
      await joinGame({
        gameId: gameId as Id<"games">,
        playerId: player._id,
      });
      
      // Then, if there's an initial buy-in amount, create a transaction
      // This will go through the approval flow for non-session-creators
      if (buyInValue > 0) {
        const result = await createTransaction({
          gameId: gameId as Id<"games">,
          playerId: player._id,
          type: "buyin",
          amount: buyInValue,
          description: "Initial buy-in",
          createdById: userId,
        });
        
        // Show feedback if transaction is pending
        if (result.status === "PENDING") {
          showNotification("You've joined the session! Your initial buy-in request has been submitted and is awaiting approval from the session host.", { type: "success", title: "Request Submitted" });
        }
      }
      
      setShowBuyInDialog(false);
      setInitialBuyInAmount("");
    } catch (error) {
      console.error("[handleJoinGame] Error joining game:", error);
      showNotification("Failed to join session. Please try again.", { type: "error" });
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
      gameId: gameId as Id<"games">,
      playerId: player._id,
      type: type === "buyin" ? "buyin" : "cashout",
      amount,
      description,
      createdById: userId,
    });

    // Show feedback if transaction is pending
    if (result.status === "PENDING") {
      const transactionType = type === "buyin" ? "buy-in" : "cash-out";
      showNotification(`Your ${transactionType} request has been submitted and is awaiting approval from the session host.`, { type: "success", title: "Request Submitted" });
    }
  }

  async function handleApproveTransaction(txId: Id<"transactions">) {
    if (!userId) return;
    setIsApprovingId(txId);
    try {
      await approveTransaction({ transactionId: txId, userId });
    } catch (error) {
      console.error("Failed to approve transaction:", error);
      showNotification("Failed to approve transaction. Please try again.", { type: "error" });
    } finally {
      setIsApprovingId(null);
    }
  }

  async function handleRejectTransaction(txId: Id<"transactions">) {
    if (!userId) return;
    setIsRejectingId(txId);
    try {
      await rejectTransaction({ transactionId: txId, userId });
    } catch (error) {
      console.error("Failed to reject transaction:", error);
      showNotification("Failed to reject transaction. Please try again.", { type: "error" });
    } finally {
      setIsRejectingId(null);
    }
  }

  async function handleUpdateTransaction() {
    if (!userId || !editingTransaction) return;
    setIsSubmitting(true);
    try {
      await updateTransaction({
        transactionId: editingTransaction.id,
        userId,
        amount: Number(editingTransaction.amount),
      });
      setEditingTransaction(null);
    } catch (error) {
      console.error("Failed to update transaction:", error);
      showNotification("Failed to update transaction. Please try again.", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePlayerTotals() {
    if (!userId || !editingPlayerTotals) return;
    setIsUpdatingPlayerTotals(true);
    try {
      await setPlayerTotals({
        gameId: gameId as Id<"games">,
        playerId: editingPlayerTotals.playerId,
        userId,
        buyIn: Number(editingPlayerTotals.buyIn),
        cashOut: Number(editingPlayerTotals.cashOut),
      });
      setEditingPlayerTotals(null);
    } catch (error) {
      console.error("Failed to update player totals:", error);
      showNotification("Failed to update player totals. Please try again.", { type: "error" });
    } finally {
      setIsUpdatingPlayerTotals(false);
    }
  }

  async function handleDeleteTransaction(txId: Id<"transactions">) {
    if (!userId) return;
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    setIsDeletingTxId(txId);
    try {
      await deleteTransactionMutation({ transactionId: txId, userId });
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      showNotification("Failed to delete transaction. Please try again.", { type: "error" });
    } finally {
      setIsDeletingTxId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-2xl sm:text-3xl">Session Details</h1>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusColorClass(game.status)}`}
              >
                {game.status}
              </span>
              {isSessionCreator && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-medium text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  <Banknote className="h-3 w-3" />
                  Banker
                </span>
              )}
            </div>
            {/* Owner-only actions menu - positioned to the right on mobile */}
            {canManage && (
              <div className="relative flex-shrink-0 sm:hidden">
                <Button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  size="sm"
                  variant="outline"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showActionsMenu && (
                  <div className="fixed inset-x-4 top-auto bottom-20 z-50 w-auto rounded-md border bg-background shadow-lg">
                    <div className="p-1">
                      <button
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                        onClick={openEditDialog}
                        type="button"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit Session
                      </button>

                      {/* Status change options */}
                      {game.status !== "ACTIVE" && (
                        <button
                          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => handleStatusChange("ACTIVE")}
                          type="button"
                        >
                          Mark as Active
                        </button>
                      )}
                      {game.status !== "COMPLETED" && (
                        <button
                          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => handleStatusChange("COMPLETED")}
                          type="button"
                        >
                          Mark as Completed
                        </button>
                      )}

                      <div className="my-1 h-px bg-border" />

                      <button
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          setShowDeleteDialog(true);
                          setShowActionsMenu(false);
                        }}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-sm sm:text-base">
            {format(new Date(game.date), "MMMM dd, yyyy")}
            {game.location && (
              <span className="hidden sm:inline"> • {game.location}</span>
            )}
            {game.group && (
              <>
                {" • "}
                <Link
                  className="inline-flex items-center gap-1 hover:underline"
                  href={`/groups/${game.group.id}`}
                >
                  <Users className="h-3 w-3" />
                  {game.group.name}
                </Link>
              </>
            )}
            {game.createdBy && (
              <>
                {" • "}
                <span className="inline-flex items-center gap-1">
                  <PiggyBank className="h-3 w-3 text-amber-600" />
                  <span>
                    Banker: {game.createdBy.name}
                    {isSessionCreator && (
                      <span className="ml-1 text-amber-600">(You)</span>
                    )}
                  </span>
                </span>
              </>
            )}
          </p>
          {game.location && (
            <p className="mt-1 text-muted-foreground text-sm sm:hidden">
              {game.location}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {game.status === "ACTIVE" && !isJoined && (
            <Button onClick={handleJoinClick} className="flex-1 sm:flex-none">
              Join Session
            </Button>
          )}

          {/* Owner-only actions menu - desktop version */}
          {canManage && (
            <div className="relative hidden sm:block">
              <Button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                size="sm"
                variant="outline"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {showActionsMenu && (
                <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border bg-background shadow-lg">
                  <div className="p-1">
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                      onClick={openEditDialog}
                      type="button"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Session
                    </button>

                    {/* Status change options */}
                    {game.status !== "ACTIVE" && (
                      <button
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => handleStatusChange("ACTIVE")}
                        type="button"
                      >
                        Mark as Active
                      </button>
                    )}
                    {game.status !== "COMPLETED" && (
                      <button
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => handleStatusChange("COMPLETED")}
                        type="button"
                      >
                        Mark as Completed
                      </button>
                    )}

                    <div className="my-1 h-px bg-border" />

                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        setShowDeleteDialog(true);
                        setShowActionsMenu(false);
                      }}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Players</CardTitle>
                <CardDescription>
                  {playersCount} {playersCount === 1 ? "player" : "players"} in
                  this session
                  {game.createdBy && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                      <PiggyBank className="h-3 w-3" />
                      {game.createdBy.name}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPlayersExpanded(!isPlayersExpanded)}
                className="h-8 w-8 p-0"
              >
                {isPlayersExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(game.gamePlayers?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No players yet</p>
            ) : (
              <ResponsiveTable
                data={
                  isPlayersExpanded
                    ? sortedGamePlayers
                    : sortedGamePlayers.slice(0, 3)
                }
                keyExtractor={(gp) => gp.id}
                columns={[
                  {
                    key: "player",
                    header: "Player",
                    render: (gp) => gp.player?.name,
                  },
                  {
                    key: "buyIn",
                    header: renderSortableHeader("Buy-In", "buyIn"),
                    render: (gp) => `$${gp.buyIn.toFixed(2)}`,
                  },
                  {
                    key: "cashOut",
                    header: renderSortableHeader("Cash-Out", "cashOut"),
                    render: (gp) =>
                      gp.cashOut !== null && gp.cashOut !== undefined
                        ? `$${gp.cashOut.toFixed(2)}`
                        : "—",
                  },
                  {
                    key: "profit",
                    header: renderSortableHeader("Profit", "profit"),
                    render: (gp) => {
                      const profit = gp.profit ?? (gp.cashOut ?? 0) - (gp.buyIn ?? 0);
                      return (
                        <span
                          className={`font-medium ${
                            profit >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                        </span>
                      );
                    },
                  },
                  {
                    key: "actions",
                    header: "",
                    className: "w-10 text-right",
                    render: (gp) =>
                      isSessionCreator ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditingPlayerTotals({
                              playerId: gp.playerId as Id<"players">,
                              playerName: gp.player?.name ?? "Unknown",
                              buyIn: gp.buyIn.toFixed(2),
                              cashOut: (gp.cashOut ?? 0).toFixed(2),
                            })
                          }
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      ) : null,
                  },
                ]}
                renderCard={(gp) => (
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="font-medium">{gp.player?.name}</div>
                      {isSessionCreator && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditingPlayerTotals({
                              playerId: gp.playerId as Id<"players">,
                              playerName: gp.player?.name ?? "Unknown",
                              buyIn: gp.buyIn.toFixed(2),
                              cashOut: (gp.cashOut ?? 0).toFixed(2),
                            })
                          }
                          className="h-7 w-7 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Buy-In</p>
                        <p className="font-medium">${gp.buyIn.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cash-Out</p>
                        <p className="font-medium">
                          {gp.cashOut !== null && gp.cashOut !== undefined
                            ? `$${gp.cashOut.toFixed(2)}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit</p>
                        {(() => {
                          const profit = gp.profit ?? (gp.cashOut ?? 0) - (gp.buyIn ?? 0);
                          return (
                            <p
                              className={`font-medium ${
                                profit >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>Buy-ins and cash-outs</CardDescription>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    Total bought in: ${totalBoughtIn.toFixed(2)}
                  </div>
                  <div>
                    Total cashed out: ${totalCashedOut.toFixed(2)}
                  </div>
                  <div>
                    Banker loss: ${bankerLoss.toFixed(2)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setIsTransactionsExpanded(!isTransactionsExpanded)
                  }
                  className="h-8 w-8 p-0"
                >
                  {isTransactionsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(transactions?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-2">
                {transactions
                  ?.filter((tx) => tx.status !== "PENDING" && tx.status !== "REJECTED")
                  .slice(0, isTransactionsExpanded ? undefined : 3)
                  .map((transaction) => (
                  <div
                    className="flex items-center justify-between rounded border p-3"
                    key={transaction._id}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {transaction.type === "buyin" ? "Buy-In" : "Cash-Out"}
                        </p>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {transaction.player?.name} •{" "}
                        {format(new Date(transaction._creationTime), "h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          transaction.type === "buyin"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {transaction.type === "buyin" ? "-" : "+"}$
                        {transaction.amount.toFixed(2)}
                      </span>
                      {isSessionCreator && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTransaction({
                              id: transaction._id as Id<"transactions">,
                              amount: transaction.amount.toString(),
                              type: transaction.type,
                              playerName: transaction.player?.name ?? "Unknown",
                            })}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isDeletingTxId === transaction._id}
                            onClick={() => handleDeleteTransaction(transaction._id as Id<"transactions">)}
                          >
                            {isDeletingTxId === transaction._id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3 text-red-500" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Transaction Requests - Only visible to session creator */}
      {isSessionCreator && pendingBuyIns && pendingBuyIns.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <CardTitle>Pending Transaction Requests</CardTitle>
                  <CardDescription>
                    Review and approve buy-in and cash-out requests from players
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPendingExpanded(!isPendingExpanded)}
                className="h-8 w-8 p-0"
              >
                {isPendingExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingBuyIns
                .slice(0, isPendingExpanded ? undefined : 3)
                .map((tx) => (
                <div
                  className="flex items-center justify-between rounded-lg border bg-background p-4"
                  key={tx._id}
                >
                  <div>
                    <p className="font-medium">{tx.player?.name ?? "Unknown"}</p>
                    <p className="text-muted-foreground text-sm">
                      Requested ${tx.amount.toFixed(2)} {tx.type === "buyin" ? "buy-in" : "cash-out"} •{" "}
                      {format(new Date(tx._creationTime), "h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                      disabled={isRejectingId === tx._id || isApprovingId === tx._id}
                      onClick={() => handleRejectTransaction(tx._id as Id<"transactions">)}
                    >
                      {isRejectingId === tx._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="mr-1 h-4 w-4" />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isApprovingId === tx._id || isRejectingId === tx._id}
                      onClick={() => handleApproveTransaction(tx._id as Id<"transactions">)}
                    >
                      {isApprovingId === tx._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-4 w-4" />
                          Approve
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {game.status === "ACTIVE" && isJoined && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>What would you like to do?</CardDescription>
          </CardHeader>
          <CardContent>
            {activeAction === null ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setActiveAction("buyin")}
                >
                  <Banknote className="h-8 w-8 text-green-600" />
                  <span>Buy-in</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setActiveAction("cashout")}
                >
                  <HandCoins className="h-8 w-8 text-blue-600" />
                  <span>Cash Out</span>
                </Button>
              </div>
            ) : activeAction === "buyin" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveAction(null);
                      setBuyInAmount("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">Buy-in Amount</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isSubmittingTransaction}
                      id="buyin-amount"
                      min="0"
                      onChange={(e) => setBuyInAmount(e.target.value)}
                      onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      inputMode="decimal"
                      value={buyInAmount}
                      autoFocus
                    />
                  </div>
                  <Button
                    disabled={
                      isSubmittingTransaction || !buyInAmount || Number(buyInAmount) <= 0
                    }
                    onClick={async () => {
                      const amount = Number(buyInAmount);
                      if (amount > 0) {
                        setIsSubmittingTransaction(true);
                        try {
                          await handleCreateTransaction("buyin", amount);
                          setBuyInAmount("");
                          setActiveAction(null);
                        } finally {
                          setIsSubmittingTransaction(false);
                        }
                      }
                    }}
                  >
                    {isSubmittingTransaction ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add Buy-in"
                    )}
                  </Button>
                </div>
              </div>
            ) : activeAction === "cashout" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveAction(null);
                      setCashOutAmount("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">Cash Out Amount</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isSubmittingTransaction}
                      id="cashout-amount"
                      min="0"
                      onChange={(e) => setCashOutAmount(e.target.value)}
                      onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      inputMode="decimal"
                      value={cashOutAmount}
                      autoFocus
                    />
                  </div>
                  <Button
                    disabled={
                      isSubmittingTransaction || !cashOutAmount || Number(cashOutAmount) <= 0
                    }
                    onClick={async () => {
                      const amount = Number(cashOutAmount);
                      if (amount > 0) {
                        setIsSubmittingTransaction(true);
                        try {
                          await handleCreateTransaction("cashout", amount);
                          setCashOutAmount("");
                          setActiveAction(null);
                        } finally {
                          setIsSubmittingTransaction(false);
                        }
                      }
                    }}
                  >
                    {isSubmittingTransaction ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Cash Out"
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}



      {/* Edit Session Dialog */}
      <Dialog onOpenChange={setShowEditDialog} open={showEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update session details. Group owners and session bankers can make changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                onChange={(e) => setEditDate(e.target.value)}
                type="date"
                value={editDate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g., John's House"
                value={editLocation}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                onValueChange={(val) =>
                  setEditStatus(val as "ACTIVE" | "COMPLETED")
                }
                value={editStatus}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => setShowEditDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={handleSaveEdit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot
              be undone. All players, transactions, and data associated with
              this session will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleDelete}
              variant="destructive"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Session"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Info Modal */}
      <PaymentInfoModal
        open={showPaymentModal}
        onSuccess={handlePaymentSuccess}
      />

      {/* Initial Buy-In Dialog */}
      <Dialog open={showBuyInDialog} onOpenChange={setShowBuyInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Session</DialogTitle>
            <DialogDescription>
              Enter your initial buy-in amount to join this session. You can add more later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="initial-buyin">Initial Buy-In Amount</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="initial-buyin"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={initialBuyInAmount}
                onChange={(e) => setInitialBuyInAmount(e.target.value)}
                className="pl-7"
                autoFocus
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Leave at $0 if you want to buy in later
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBuyInDialog(false)}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button onClick={handleJoinWithBuyIn} disabled={isJoining}>
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Session"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Edit {editingTransaction?.type === "buyin" ? "buy-in" : "cash-out"} for {editingTransaction?.playerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tx-amount">Amount</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="edit-tx-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={editingTransaction?.amount ?? ""}
                  onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                  onChange={(e) =>
                    setEditingTransaction((prev) =>
                      prev ? { ...prev, amount: e.target.value } : null
                    )
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setEditingTransaction(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isSubmitting ||
                !editingTransaction?.amount ||
                Number(editingTransaction?.amount) <= 0
              }
              onClick={handleUpdateTransaction}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Player Totals Dialog */}
      <Dialog
        open={!!editingPlayerTotals}
        onOpenChange={(open) => !open && setEditingPlayerTotals(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player Totals</DialogTitle>
            <DialogDescription>
              Update totals for {editingPlayerTotals?.playerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-player-buyin">Total buy-in</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="edit-player-buyin"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={editingPlayerTotals?.buyIn ?? ""}
                  onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                  onChange={(e) =>
                    setEditingPlayerTotals((prev) =>
                      prev ? { ...prev, buyIn: e.target.value } : null
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-player-cashout">Total cash-out</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="edit-player-cashout"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={editingPlayerTotals?.cashOut ?? ""}
                  onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                  onChange={(e) =>
                    setEditingPlayerTotals((prev) =>
                      prev ? { ...prev, cashOut: e.target.value } : null
                    )
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUpdatingPlayerTotals}
              onClick={() => setEditingPlayerTotals(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isUpdatingPlayerTotals ||
                !editingPlayerTotals?.buyIn ||
                Number(editingPlayerTotals?.buyIn) < 0 ||
                !editingPlayerTotals?.cashOut ||
                Number(editingPlayerTotals?.cashOut) < 0
              }
              onClick={handleUpdatePlayerTotals}
            >
              {isUpdatingPlayerTotals ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Click outside to close actions menu */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionsMenu(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowActionsMenu(false)}
        />
      )}
    </div>
  );
}
