"use client";

import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, RadioTower, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useNotification } from "@/components/providers/notification-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConvexUser } from "@/lib/convex-hooks";
import {
  useDeleteLivePokerTable,
  useLivePokerTables,
} from "@/lib/live-poker-hooks";
import type { Id } from "../../../convex/_generated/dataModel";

function chip(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function getTableActionLabel(table: {
  isCreatedByCurrentUser: boolean;
  isCurrentUserSettled: boolean;
}) {
  if (table.isCreatedByCurrentUser) {
    return "Open Table";
  }

  if (table.isCurrentUserSettled) {
    return "Rejoin Table";
  }

  return "Join Table";
}

export function LivePokerLobbyClient() {
  const { showNotification } = useNotification();
  const { userId } = useConvexUser();
  const { tables, isLoading } = useLivePokerTables(userId);
  const deleteLivePokerTable = useDeleteLivePokerTable();
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);
  const [pendingDeleteTableId, setPendingDeleteTableId] = useState<
    string | null
  >(null);

  async function handleDeleteTable() {
    if (!(userId && pendingDeleteTableId)) {
      return;
    }

    setDeletingTableId(pendingDeleteTableId);
    try {
      await deleteLivePokerTable({
        tableId: pendingDeleteTableId as Id<"livePokerTables">,
        userId,
      });
      setPendingDeleteTableId(null);
      showNotification("Live poker table deleted.", { type: "success" });
    } catch (error) {
      console.error("Failed to delete live poker table:", error);
      showNotification("Failed to delete live poker table.", { type: "error" });
    } finally {
      setDeletingTableId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RadioTower className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">
              No live poker tables are open.
            </p>
            <Link href="/live-poker/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Table
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const tableActionLabel = getTableActionLabel(table);

          return (
            <Card key={table.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-lg">
                      {table.title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Hosted by {table.createdBy.name}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800 text-xs dark:bg-emerald-900 dark:text-emerald-200">
                    {table.liveStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Blinds</p>
                    <p className="font-medium">
                      {chip(table.smallBlind)} / {chip(table.bigBlind)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Buy-in</p>
                    <p className="font-medium">
                      {chip(table.minBuyIn)}-{chip(table.maxBuyIn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seats</p>
                    <p className="flex items-center gap-1 font-medium">
                      <Users className="h-3.5 w-3.5" />
                      {table.seatCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(table.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link className="flex-1" href={`/live-poker/${table.id}`}>
                    <Button className="w-full">{tableActionLabel}</Button>
                  </Link>
                  {table.isCreatedByCurrentUser ? (
                    <Button
                      className="shrink-0"
                      disabled={deletingTableId === table.id}
                      onClick={() => setPendingDeleteTableId(table.id)}
                      variant="outline"
                    >
                      {deletingTableId === table.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteTableId(null);
          }
        }}
        open={pendingDeleteTableId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete live poker table?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes the table, settles every occupied seat, and prevents
              anyone from reconnecting. Ledger and hand history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingTableId !== null}
              onClick={handleDeleteTable}
            >
              Delete Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
