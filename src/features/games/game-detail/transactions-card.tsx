"use client";

import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  EditingTransactionState,
  GameTransactionRow,
} from "./game-detail-types";
import { formatSessionMoney } from "./game-detail-utils";

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
  const sortedTransactions = [...transactions].sort(
    (a, b) => b._creationTime - a._creationTime
  );
  return (
    <div className="space-y-5 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-sm">
        <p>Individual buy-ins and cash-outs</p>
        <p>Newest first</p>
      </div>
      {transactions.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          No transactions yet
        </p>
      ) : (
        <Table aria-label="Transaction history" className="text-xs sm:text-sm">
          <TableHeader className="hidden bg-muted/40 sm:table-header-group">
            <TableRow>
              <TableHead className="px-2 sm:px-4">Transaction</TableHead>
              <TableHead className="px-2 sm:px-4">Player</TableHead>
              <TableHead className="px-2 text-right sm:px-4">Amount</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Time
              </TableHead>
              {isSessionCreator ? (
                <TableHead className="w-20 px-1">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((transaction) => (
              <TransactionRow
                isDeletingTxId={isDeletingTxId}
                isSessionCreator={isSessionCreator}
                key={transaction._id}
                onDeleteTransaction={onDeleteTransaction}
                onEditTransaction={onEditTransaction}
                transaction={transaction}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function TransactionRow({
  transaction,
  isDeletingTxId,
  isSessionCreator,
  onDeleteTransaction,
  onEditTransaction,
}: Omit<TransactionsCardProps, "transactions"> & {
  transaction: GameTransactionRow;
}) {
  const name = transaction.player?.name ?? "Unknown";
  const buyIn = transaction.type === "buyin";
  const Icon = buyIn ? ArrowDownLeft : ArrowUpRight;
  const label = buyIn ? "Buy-in" : "Cash-out";
  const sign = buyIn ? "−" : "+";
  const textColor = buyIn
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400";
  const iconColor = buyIn ? "bg-red-500/10" : "bg-green-500/10";
  const deleting = isDeletingTxId === transaction._id;
  const DeleteIcon = deleting ? Loader2 : Trash2;
  const time = format(new Date(transaction._creationTime), "h:mm a");
  return (
    <TableRow className="grid grid-cols-2 sm:table-row">
      <TableCell className="col-start-1 row-start-1 px-2 pt-4 pb-1 sm:px-4 sm:py-5">
        <span className="inline-flex items-center gap-3 whitespace-nowrap">
          <span
            className={`hidden rounded-md p-2 sm:inline-flex ${iconColor} ${textColor}`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          {label}
        </span>
      </TableCell>
      <TableCell className="col-start-1 row-start-2 px-2 pt-0 pb-4 sm:px-4 sm:py-4">
        <span className="font-medium">{name}</span>
        <span className="mt-1 block text-muted-foreground text-xs md:hidden">
          {time}
        </span>
      </TableCell>
      <TableCell
        className={`col-start-2 row-start-1 whitespace-nowrap px-2 pt-4 pb-1 text-right font-medium tabular-nums sm:px-4 sm:py-4 ${textColor}`}
      >
        {sign}
        {formatSessionMoney(transaction.amount)}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-right text-muted-foreground md:table-cell">
        {time}
      </TableCell>
      {isSessionCreator ? (
        <TableCell className="col-start-2 row-start-2 px-1 pt-0 pb-4 sm:py-4">
          <div className="flex justify-end">
            <Button
              aria-label={`Edit ${label.toLowerCase()} for ${name}`}
              className="h-9 w-9"
              onClick={() =>
                onEditTransaction({
                  amount: transaction.amount.toString(),
                  id: transaction._id as Id<"transactions">,
                  playerName: name,
                  type: transaction.type,
                })
              }
              size="icon"
              variant="ghost"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              aria-label={`Delete ${label.toLowerCase()} for ${name}`}
              className="h-9 w-9"
              disabled={isDeletingTxId === transaction._id}
              onClick={() =>
                onDeleteTransaction(transaction._id as Id<"transactions">)
              }
              size="icon"
              variant="ghost"
            >
              <DeleteIcon
                className={
                  deleting
                    ? "h-3.5 w-3.5 animate-spin"
                    : "h-3.5 w-3.5 text-red-500"
                }
              />
            </Button>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
