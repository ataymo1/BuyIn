"use client";

import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import type {
  EditingPlayerTotalsState,
  EditingTransactionState,
} from "./game-detail-types";

interface GameDetailDialogsProps {
  editDate: string;
  editGameType: "cash" | "tournament";
  editLocation: string;
  editStatus: "ACTIVE" | "COMPLETED";
  editingPlayerTotals: EditingPlayerTotalsState | null;
  editingTransaction: EditingTransactionState | null;
  initialBuyInAmount: string;
  isJoining: boolean;
  isSubmitting: boolean;
  isUpdatingPlayerTotals: boolean;
  onBuyInAmountChange: (value: string) => void;
  onCloseBuyInDialog: () => void;
  onDelete: () => void;
  onDeleteDialogChange: (open: boolean) => void;
  onEditDateChange: (value: string) => void;
  onEditDialogChange: (open: boolean) => void;
  onEditGameTypeChange: (value: "cash" | "tournament") => void;
  onEditLocationChange: (value: string) => void;
  onEditStatusChange: (value: "ACTIVE" | "COMPLETED") => void;
  onEditingPlayerTotalsChange: (value: EditingPlayerTotalsState | null) => void;
  onEditingTransactionChange: (value: EditingTransactionState | null) => void;
  onJoin: () => void;
  onPaymentSuccess: () => void;
  onSaveEdit: () => void;
  onShowBuyInDialogChange: (open: boolean) => void;
  onShowPaymentModalChange: (open: boolean) => void;
  onUpdatePlayerTotals: () => void;
  onUpdateTransaction: () => void;
  showBuyInDialog: boolean;
  showDeleteDialog: boolean;
  showEditDialog: boolean;
  showPaymentModal: boolean;
}

export function GameDetailDialogs({
  editDate,
  editGameType,
  editLocation,
  editStatus,
  editingPlayerTotals,
  editingTransaction,
  initialBuyInAmount,
  isJoining,
  isSubmitting,
  isUpdatingPlayerTotals,
  onBuyInAmountChange,
  onCloseBuyInDialog,
  onDelete,
  onDeleteDialogChange,
  onEditDateChange,
  onEditDialogChange,
  onEditGameTypeChange,
  onEditLocationChange,
  onEditStatusChange,
  onEditingPlayerTotalsChange,
  onEditingTransactionChange,
  onJoin,
  onPaymentSuccess,
  onSaveEdit,
  onShowBuyInDialogChange,
  onShowPaymentModalChange,
  onUpdatePlayerTotals,
  onUpdateTransaction,
  showBuyInDialog,
  showDeleteDialog,
  showEditDialog,
  showPaymentModal,
}: GameDetailDialogsProps) {
  return (
    <>
      <Dialog onOpenChange={onEditDialogChange} open={showEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update session details. Group owners and session bankers can make
              changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                onChange={(event) => onEditDateChange(event.target.value)}
                type="date"
                value={editDate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                onChange={(event) => onEditLocationChange(event.target.value)}
                placeholder="e.g., John's House"
                value={editLocation}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select onValueChange={onEditStatusChange} value={editStatus}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-game-type">Game Type</Label>
              <Select
                onValueChange={onEditGameTypeChange}
                value={editGameType}
              >
                <SelectTrigger id="edit-game-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash Game</SelectItem>
                  <SelectItem value="tournament">Tournament</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => onEditDialogChange(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={onSaveEdit}>
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

      <Dialog onOpenChange={onDeleteDialogChange} open={showDeleteDialog}>
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
              onClick={() => onDeleteDialogChange(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={onDelete}
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

      <PaymentInfoModal onSuccess={onPaymentSuccess} open={showPaymentModal} />

      <Dialog open={showBuyInDialog} onOpenChange={onShowBuyInDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Session</DialogTitle>
            <DialogDescription>
              Enter your initial buy-in amount to join this session. You can
              add more later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="initial-buyin">Initial Buy-In Amount</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                autoFocus
                className="pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                id="initial-buyin"
                inputMode="decimal"
                min="0"
                onChange={(event) => onBuyInAmountChange(event.target.value)}
                onKeyDown={(event) =>
                  ["e", "E", "+", "-"].includes(event.key) &&
                  event.preventDefault()
                }
                pattern="[0-9]*[.]?[0-9]*"
                placeholder="0.00"
                step="0.01"
                type="number"
                value={initialBuyInAmount}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Leave at $0 if you want to buy in later
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={isJoining}
              onClick={onCloseBuyInDialog}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isJoining} onClick={onJoin}>
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

      <Dialog
        onOpenChange={(open) => !open && onEditingTransactionChange(null)}
        open={!!editingTransaction}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Edit {editingTransaction?.type === "buyin" ? "buy-in" : "cash-out"}{" "}
              for {editingTransaction?.playerName}
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
                  className="pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  id="edit-tx-amount"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    onEditingTransactionChange(
                      editingTransaction
                        ? { ...editingTransaction, amount: event.target.value }
                        : null
                    )
                  }
                  onKeyDown={(event) =>
                    ["e", "E", "+", "-"].includes(event.key) &&
                    event.preventDefault()
                  }
                  step="0.01"
                  type="number"
                  value={editingTransaction?.amount ?? ""}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => onEditingTransactionChange(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                isSubmitting ||
                !editingTransaction?.amount ||
                Number(editingTransaction.amount) <= 0
              }
              onClick={onUpdateTransaction}
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

      <Dialog
        onOpenChange={(open) => !open && onEditingPlayerTotalsChange(null)}
        open={!!editingPlayerTotals}
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
                  className="pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  id="edit-player-buyin"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    onEditingPlayerTotalsChange(
                      editingPlayerTotals
                        ? { ...editingPlayerTotals, buyIn: event.target.value }
                        : null
                    )
                  }
                  onKeyDown={(event) =>
                    ["e", "E", "+", "-"].includes(event.key) &&
                    event.preventDefault()
                  }
                  step="0.01"
                  type="number"
                  value={editingPlayerTotals?.buyIn ?? ""}
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
                  className="pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  id="edit-player-cashout"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    onEditingPlayerTotalsChange(
                      editingPlayerTotals
                        ? { ...editingPlayerTotals, cashOut: event.target.value }
                        : null
                    )
                  }
                  onKeyDown={(event) =>
                    ["e", "E", "+", "-"].includes(event.key) &&
                    event.preventDefault()
                  }
                  step="0.01"
                  type="number"
                  value={editingPlayerTotals?.cashOut ?? ""}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={isUpdatingPlayerTotals}
              onClick={() => onEditingPlayerTotalsChange(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isUpdatingPlayerTotals}
              onClick={onUpdatePlayerTotals}
            >
              {isUpdatingPlayerTotals ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Totals"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
