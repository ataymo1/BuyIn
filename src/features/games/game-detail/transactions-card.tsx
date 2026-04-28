"use client";

import { format } from "date-fns";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  EditingTransactionState,
  GameTransactionRow,
} from "./game-detail-types";

interface TransactionsCardProps {
  isDeletingTxId: string | null;
  isSessionCreator: boolean;
  onDeleteTransaction: (transactionId: Id<"transactions">) => void;
  onEditTransaction: (value: EditingTransactionState) => void;
  transactions: GameTransactionRow[];
}

export function TransactionsCard({
  isDeletingTxId,
  isSessionCreator,
  onDeleteTransaction,
  onEditTransaction,
  transactions,
}: TransactionsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalBoughtIn = transactions.reduce(
    (sum, transaction) =>
      transaction.type === "buyin" ? sum + transaction.amount : sum,
    0
  );
  const totalCashedOut = transactions.reduce(
    (sum, transaction) =>
      transaction.type === "cashout" ? sum + transaction.amount : sum,
    0
  );
  const bankerLoss = Math.max(0, totalCashedOut - totalBoughtIn);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Buy-ins and cash-outs</CardDescription>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right text-muted-foreground text-xs">
              <div>Total bought in: ${totalBoughtIn.toFixed(2)}</div>
              <div>Total cashed out: ${totalCashedOut.toFixed(2)}</div>
              <div>Banker loss: ${bankerLoss.toFixed(2)}</div>
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
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions
              .slice(0, isExpanded ? undefined : 3)
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
                      {transaction.player?.name ?? "Unknown"} |{" "}
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

                    {isSessionCreator ? (
                      <div className="flex gap-1">
                        <Button
                          onClick={() =>
                            onEditTransaction({
                              amount: transaction.amount.toString(),
                              id: transaction._id as Id<"transactions">,
                              playerName: transaction.player?.name ?? "Unknown",
                              type: transaction.type,
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          disabled={isDeletingTxId === transaction._id}
                          onClick={() =>
                            onDeleteTransaction(
                              transaction._id as Id<"transactions">
                            )
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {isDeletingTxId === transaction._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-red-500" />
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
