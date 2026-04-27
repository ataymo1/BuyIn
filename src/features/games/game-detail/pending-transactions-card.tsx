"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { Check, ChevronDown, ChevronUp, Clock, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { GameTransactionRow } from "./game-detail-types";

interface PendingTransactionsCardProps {
  isApprovingId: string | null;
  isRejectingId: string | null;
  onApprove: (transactionId: Id<"transactions">) => void;
  onReject: (transactionId: Id<"transactions">) => void;
  pendingTransactions: GameTransactionRow[];
}

export function PendingTransactionsCard({
  isApprovingId,
  isRejectingId,
  onApprove,
  onReject,
  pendingTransactions,
}: PendingTransactionsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (pendingTransactions.length === 0) return null;

  return (
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
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded((current) => !current)}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingTransactions
            .slice(0, isExpanded ? undefined : 3)
            .map((transaction) => (
              <div
                className="flex items-center justify-between rounded-lg border bg-background p-4"
                key={transaction._id}
              >
                <div>
                  <p className="font-medium">
                    {transaction.player?.name ?? "Unknown"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Requested ${transaction.amount.toFixed(2)}{" "}
                    {transaction.type === "buyin" ? "buy-in" : "cash-out"} at{" "}
                    {format(new Date(transaction._creationTime), "h:mm a")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                    disabled={
                      isRejectingId === transaction._id ||
                      isApprovingId === transaction._id
                    }
                    onClick={() =>
                      onReject(transaction._id as Id<"transactions">)
                    }
                    size="sm"
                    variant="outline"
                  >
                    {isRejectingId === transaction._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </>
                    )}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={
                      isApprovingId === transaction._id ||
                      isRejectingId === transaction._id
                    }
                    onClick={() =>
                      onApprove(transaction._id as Id<"transactions">)
                    }
                    size="sm"
                  >
                    {isApprovingId === transaction._id ? (
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
  );
}
