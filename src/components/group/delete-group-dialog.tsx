"use client";

import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeleteGroupDialogProps {
  groupId: Id<"groups">;
  groupName: string;
}

export function DeleteGroupDialog({
  groupId,
  groupName,
}: DeleteGroupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteGroup = useMutation(api.groups.deleteGroup);

  const isConfirmValid = confirmText === groupName;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setConfirmText("");
      setError(null);
    }
  };

  const handleDelete = async () => {
    if (!isConfirmValid) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await deleteGroup({ groupId });
      setOpen(false);
      router.push("/groups");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete group";
      setError(errorMessage);
      console.error("Error deleting group:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Group</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the group{" "}
            <strong>&quot;{groupName}&quot;</strong> and all associated data
            including game sessions, transactions, and member connections.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <strong>{groupName}</strong> to confirm
            </Label>
            <Input
              autoComplete="off"
              id="confirm-delete"
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Enter group name to confirm"
              value={confirmText}
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isDeleting}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!isConfirmValid || isDeleting}
            onClick={handleDelete}
            type="button"
            variant="destructive"
          >
            {isDeleting ? "Deleting..." : "Delete Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
