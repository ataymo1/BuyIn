"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Banknote,
  Check,
  Clock,
  Edit2,
  HandCoins,
  Loader2,
  MoreVertical,
  Pencil,
  Skull,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useConvexUser, usePlayer } from "@/lib/convex-hooks";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
  const { userId, isLoading: userLoading } = useConvexUser();
  const { player, isLoading: playerLoading } = usePlayer();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Transaction form state
  const [activeAction, setActiveAction] = useState<"buyin" | "cashout" | "busted" | null>(null);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);

  // Edit form state
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
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
  const joinGame = useMutation(api.games.joinGame);
  const updateGame = useMutation(api.games.updateGame);
  const updateGameStatus = useMutation(api.games.updateGameStatus);
  const deleteGame = useMutation(api.games.deleteGame);

  const isLoading = userLoading || playerLoading || game === undefined;

  // Open edit dialog and populate form
  function openEditDialog() {
    if (game) {
      setEditLocation(game.location ?? "");
      setEditNotes(game.notes ?? "");
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
        notes: editNotes || undefined,
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
      alert("Failed to update session. Please try again.");
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
      alert("Failed to delete session. Please try again.");
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
      alert("Failed to update status. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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

  function handleJoinClick() {
    setShowPaymentModal(true);
  }

  async function handlePaymentSuccess() {
    setShowPaymentModal(false);
    await performJoinGame();
  }

  async function performJoinGame() {
    if (!player?._id) {
      console.error(
        "[handleJoinGame] No player record - waiting for player sync"
      );
      alert("Please wait, setting up your player profile...");
      return;
    }
    try {
      await joinGame({
        gameId: gameId as Id<"games">,
        playerId: player._id,
      });
    } catch (error) {
      console.error("[handleJoinGame] Error joining game:", error);
      alert("Failed to join session. Please try again.");
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

    // Show feedback if buy-in is pending
    if (result.status === "PENDING") {
      alert("Your buy-in request has been submitted and is awaiting approval from the session host.");
    }
  }

  async function handleApproveTransaction(txId: Id<"transactions">) {
    if (!userId) return;
    setIsApprovingId(txId);
    try {
      await approveTransaction({ transactionId: txId, userId });
    } catch (error) {
      console.error("Failed to approve transaction:", error);
      alert("Failed to approve buy-in. Please try again.");
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
      alert("Failed to reject buy-in. Please try again.");
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
      alert("Failed to update transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
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
      alert("Failed to delete transaction. Please try again.");
    } finally {
      setIsDeletingTxId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-3xl">Session Details</h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusColorClass(game.status)}`}
            >
              {game.status}
            </span>
          </div>
          <p className="text-muted-foreground">
            {format(new Date(game.date), "MMMM dd, yyyy")}
            {game.location && ` • ${game.location}`}
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
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.status === "ACTIVE" && !isJoined && (
            <Button onClick={handleJoinClick}>Join Session</Button>
          )}

          {/* Owner-only actions menu */}
          {canManage && (
            <div className="relative">
              <Button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                size="sm"
                variant="outline"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {showActionsMenu && (
                <div className="absolute top-full right-0 z-10 mt-1 w-48 rounded-md border bg-background shadow-lg">
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

      {game.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">{game.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>Players in this session</CardDescription>
          </CardHeader>
          <CardContent>
            {(game.gamePlayers?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No players yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Buy-In</TableHead>
                    <TableHead>Cash-Out</TableHead>
                    <TableHead>Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {game.gamePlayers?.map((gp) => (
                    <TableRow key={gp.id}>
                      <TableCell>{gp.player?.name}</TableCell>
                      <TableCell>${gp.buyIn.toFixed(2)}</TableCell>
                      <TableCell>
                        {gp.cashOut !== null && gp.cashOut !== undefined
                          ? `$${gp.cashOut.toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {gp.profit !== null && gp.profit !== undefined
                          ? `$${gp.profit.toFixed(2)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Buy-ins and cash-outs</CardDescription>
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

      {/* Pending Buy-In Requests - Only visible to session creator */}
      {isSessionCreator && pendingBuyIns && pendingBuyIns.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <CardTitle>Pending Buy-In Requests</CardTitle>
            </div>
            <CardDescription>
              Review and approve buy-in requests from players
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingBuyIns.map((tx) => (
                <div
                  className="flex items-center justify-between rounded-lg border bg-background p-4"
                  key={tx._id}
                >
                  <div>
                    <p className="font-medium">{tx.player?.name ?? "Unknown"}</p>
                    <p className="text-muted-foreground text-sm">
                      Requested ${tx.amount.toFixed(2)} buy-in •{" "}
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
              <div className="grid gap-4 sm:grid-cols-3">
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
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setActiveAction("busted")}
                >
                  <Skull className="h-8 w-8 text-red-600" />
                  <span>I Busted</span>
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
                      className="pl-7"
                      disabled={isSubmittingTransaction}
                      id="buyin-amount"
                      min="0"
                      onChange={(e) => setBuyInAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
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
                      className="pl-7"
                      disabled={isSubmittingTransaction}
                      id="cashout-amount"
                      min="0"
                      onChange={(e) => setCashOutAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
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
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveAction(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">Settlement Info</span>
                </div>
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Skull className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="mb-2 font-medium">P2P Settlement Coming Soon</p>
                  <p className="text-muted-foreground text-sm">
                    The peer-to-peer settlement system is being built. Once complete,
                    you&apos;ll see who you owe and their payment details here.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {game.status === "ACTIVE" && !isJoined && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="mb-4 text-muted-foreground">
              Join this session to start adding your transactions
            </p>
            <Button onClick={handleJoinClick}>Join Session</Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Session Dialog */}
      <Dialog onOpenChange={setShowEditDialog} open={showEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update session details. Only group owners can make changes.
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
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any additional notes..."
                value={editNotes}
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
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={editingTransaction?.amount ?? ""}
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

      {/* Click outside to close actions menu */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActionsMenu(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowActionsMenu(false)}
        />
      )}
    </div>
  );
}
