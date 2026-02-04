"use client";

import { Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotification } from "@/components/notification-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";

interface TransactionItemProps {
  id: string;
  playerName: string;
  type: "buyin" | "cashout";
  amount: number;
  description?: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
  gameId: string;
}

export function TransactionItem({
  id,
  playerName,
  type,
  amount,
  description,
  createdAt,
  canEdit,
  canDelete,
  gameId,
}: TransactionItemProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { showNotification } = useNotification();

  const handleUpdate = async (data: {
    type: "buyin" | "cashout";
    amount: string;
    description?: string;
  }) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        showNotification(error.error || "Failed to update transaction", { type: "error" });
        return;
      }

      setIsEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating transaction:", error);
      showNotification("Failed to update transaction", { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        showNotification(error.error || "Failed to delete transaction", { type: "error" });
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      showNotification("Failed to delete transaction", { type: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <div className="flex-1">
        <p className="font-medium">{playerName}</p>
        <p className="text-muted-foreground text-sm">
          {type === "buyin" ? "Buy-In" : "Cash-Out"}
          {description && ` • ${description}`}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {new Date(createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-bold">${amount.toFixed(2)}</p>
        {(canEdit || canDelete) && (
          <div className="flex gap-1">
            {canEdit && (
              <Dialog
                onOpenChange={setIsEditDialogOpen}
                open={isEditDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Edit className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                    <DialogDescription>
                      Update the transaction details
                    </DialogDescription>
                  </DialogHeader>
                  <TransactionForm
                    defaultValues={{
                      type,
                      amount: amount.toString(),
                      description: description || undefined,
                    }}
                    onSubmit={handleUpdate}
                  />
                </DialogContent>
              </Dialog>
            )}
            {canDelete && (
              <Button
                disabled={isDeleting}
                onClick={handleDelete}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
