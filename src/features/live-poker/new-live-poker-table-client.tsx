"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotification } from "@/components/providers/notification-provider";
import { useConvexUser } from "@/lib/convex-hooks";
import { useCreateLivePokerTable } from "@/lib/live-poker-hooks";
import {
  LivePokerTableForm,
  type LivePokerTableFormValues,
} from "./live-poker-table-form";

export function NewLivePokerTableClient() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const { userId, isLoading } = useConvexUser();
  const createLivePokerTable = useCreateLivePokerTable();
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleCreateTable(data: LivePokerTableFormValues) {
    setSubmitError(null);
    if (!userId) {
      setSubmitError("Your account is still loading. Please try again.");
      return;
    }

    try {
      const tableId = await createLivePokerTable({
        title: data.title,
        smallBlind: data.smallBlind,
        bigBlind: data.bigBlind,
        minBuyIn: data.minBuyIn,
        maxBuyIn: data.maxBuyIn,
        seatCount: data.seatCount,
        createdById: userId,
      });
      router.push(`/live-poker/${tableId}`);
    } catch (error) {
      console.error("Failed to create live poker table:", error);
      const message = "Failed to create live poker table. Please try again.";
      setSubmitError(message);
      showNotification(message, { type: "error" });
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <LivePokerTableForm
      onSubmit={handleCreateTable}
      submitError={submitError}
    />
  );
}
