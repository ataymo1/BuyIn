"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { Edit2, Loader2, MoreVertical, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

  // Transaction form state
  const [buyInAmount, setBuyInAmount] = useState("");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [isAddingBuyIn, setIsAddingBuyIn] = useState(false);
  const [isAddingCashOut, setIsAddingCashOut] = useState(false);

  // Edit form state
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "COMPLETED">(
    "ACTIVE"
  );

  const game = useQuery(api.games.getGame, { gameId: gameId as Id<"games"> });

  const transactions = useQuery(api.transactions.getTransactions, {
    gameId: gameId as Id<"games">,
  });

  // Check if user can manage this game (is group owner)
  const canManage = useQuery(
    api.games.canManageGame,
    userId ? { gameId: gameId as Id<"games">, userId } : "skip"
  );

  const createTransaction = useMutation(api.transactions.createTransaction);
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

  async function handleJoinGame() {
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
    await createTransaction({
      gameId: gameId as Id<"games">,
      playerId: player._id,
      type: type === "buyin" ? "buyin" : "cashout",
      amount,
      description,
      createdById: userId,
    });
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
            <Button onClick={handleJoinGame}>Join Session</Button>
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
                {transactions?.map((transaction) => (
                  <div
                    className="flex items-center justify-between rounded border p-3"
                    key={transaction._id}
                  >
                    <div>
                      <p className="font-medium">
                        {transaction.type === "buyin" ? "Buy-In" : "Cash-Out"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {transaction.player?.name} •{" "}
                        {format(new Date(transaction._creationTime), "h:mm a")}
                      </p>
                    </div>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {game.status === "ACTIVE" && isJoined && (
        <Card>
          <CardHeader>
            <CardTitle>Add Transaction</CardTitle>
            <CardDescription>Record your buy-in or cash-out</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Buy-In Input */}
              <div className="space-y-2">
                <Label htmlFor="buyin-amount">Buy-In Amount</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      className="pl-7"
                      disabled={isAddingBuyIn}
                      id="buyin-amount"
                      min="0"
                      onChange={(e) => setBuyInAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={buyInAmount}
                    />
                  </div>
                  <Button
                    disabled={
                      isAddingBuyIn || !buyInAmount || Number(buyInAmount) <= 0
                    }
                    onClick={async () => {
                      const amount = Number(buyInAmount);
                      if (amount > 0) {
                        setIsAddingBuyIn(true);
                        try {
                          await handleCreateTransaction("buyin", amount);
                          setBuyInAmount("");
                        } finally {
                          setIsAddingBuyIn(false);
                        }
                      }
                    }}
                  >
                    {isAddingBuyIn ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </div>

              {/* Cash-Out Input */}
              <div className="space-y-2">
                <Label htmlFor="cashout-amount">Cash-Out Amount</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      className="pl-7"
                      disabled={isAddingCashOut}
                      id="cashout-amount"
                      min="0"
                      onChange={(e) => setCashOutAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={cashOutAmount}
                    />
                  </div>
                  <Button
                    disabled={
                      isAddingCashOut ||
                      !cashOutAmount ||
                      Number(cashOutAmount) <= 0
                    }
                    onClick={async () => {
                      const amount = Number(cashOutAmount);
                      if (amount > 0) {
                        setIsAddingCashOut(true);
                        try {
                          await handleCreateTransaction("cashout", amount);
                          setCashOutAmount("");
                        } finally {
                          setIsAddingCashOut(false);
                        }
                      }
                    }}
                  >
                    {isAddingCashOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {game.status === "ACTIVE" && !isJoined && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="mb-4 text-muted-foreground">
              Join this session to start adding your transactions
            </p>
            <Button onClick={handleJoinGame}>Join Session</Button>
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
