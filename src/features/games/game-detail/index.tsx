"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GameDetailDialogs } from "./game-detail-dialogs";
import { GameDetailSkeleton } from "./game-detail-skeleton";
import { PendingTransactionsCard } from "./pending-transactions-card";
import { PlayersCard } from "./players-card";
import { SessionActionsCard } from "./session-actions-card";
import { SessionHeader } from "./session-header";
import { TransactionsCard } from "./transactions-card";
import { useGameDetailController } from "./use-game-detail-controller";

interface GameDetailClientProps {
  gameId: string;
}

export function GameDetailClient({ gameId }: GameDetailClientProps) {
  const controller = useGameDetailController(gameId);

  if (controller.isLoading) {
    return <GameDetailSkeleton />;
  }

  if (!controller.game) {
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

  const {
    canManage,
    dialogs,
    finalizedTransactions,
    game,
    gamePlayers,
    isDeletingTxId,
    isJoined,
    isSessionCreator,
    onApproveTransaction,
    onDeleteClick,
    onDeleteTransaction,
    onEditPlayerTotals,
    onEditTransaction,
    onJoinClick,
    onRejectTransaction,
    onStatusChange,
    onSubmitTransaction,
    openEditDialog,
    pendingTransactions,
    transactionApprovalState,
  } = controller;

  return (
    <div className="space-y-8">
      <SessionHeader
        canManage={canManage}
        createdByName={game.createdBy?.name}
        date={game.date}
        gameType={game.gameType ?? "cash"}
        group={
          game.group
            ? {
                id: game.group.id,
                name: game.group.name,
              }
            : null
        }
        isJoined={isJoined}
        isSessionCreator={isSessionCreator}
        location={game.location}
        onDeleteClick={onDeleteClick}
        onEditClick={openEditDialog}
        onJoinClick={onJoinClick}
        onStatusChange={onStatusChange}
        status={game.status}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PlayersCard
          createdByName={game.createdBy?.name}
          gamePlayers={gamePlayers}
          isSessionCreator={isSessionCreator}
          onEditPlayerTotals={onEditPlayerTotals}
        />
        <TransactionsCard
          isDeletingTxId={isDeletingTxId}
          isSessionCreator={isSessionCreator}
          onDeleteTransaction={onDeleteTransaction}
          onEditTransaction={onEditTransaction}
          transactions={finalizedTransactions}
        />
      </div>

      {isSessionCreator ? (
        <PendingTransactionsCard
          isApprovingId={transactionApprovalState.isApprovingId}
          isRejectingId={transactionApprovalState.isRejectingId}
          onApprove={onApproveTransaction}
          onReject={onRejectTransaction}
          pendingTransactions={pendingTransactions}
        />
      ) : null}

      {game.status === "ACTIVE" && isJoined ? (
        <SessionActionsCard onSubmitTransaction={onSubmitTransaction} />
      ) : null}

      <GameDetailDialogs {...dialogs} />
    </div>
  );
}
