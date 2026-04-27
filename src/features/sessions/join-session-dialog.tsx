"use client";

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
import { Loader2 } from "lucide-react";

interface JoinSessionDialogProps {
  amount: string;
  isJoining: boolean;
  open: boolean;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

export function JoinSessionDialog({
  amount,
  isJoining,
  open,
  onAmountChange,
  onClose,
  onSubmit,
}: JoinSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Session</DialogTitle>
          <DialogDescription>
            Enter your initial buy-in amount to join this session. You can add
            more later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="initial-buyin-sessions">Initial Buy-In Amount</Label>
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              autoFocus
              className="pl-7"
              id="initial-buyin-sessions"
              min="0"
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={amount}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Leave at $0 if you want to buy in later
          </p>
        </div>
        <DialogFooter>
          <Button disabled={isJoining} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={isJoining} onClick={onSubmit}>
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
  );
}
