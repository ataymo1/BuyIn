"use client";

import { useRouter } from "next/navigation";
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

  async function handleCreateTable(data: LivePokerTableFormValues) {
    if (!userId) {
      throw new Error("Unauthorized");
    }

    try {
      const tableId = await createLivePokerTable({
        title: data.title,
        smallBlind: Number(data.smallBlind),
        bigBlind: Number(data.bigBlind),
        minBuyIn: Number(data.minBuyIn),
        maxBuyIn: Number(data.maxBuyIn),
        seatCount: Number(data.seatCount),
        createdById: userId,
      });
      router.push(`/live-poker/${tableId}`);
    } catch (error) {
      console.error("Failed to create live poker table:", error);
      showNotification("Failed to create live poker table. Please try again.", {
        type: "error",
      });
    }
  }

  if (isLoading) {
    return null;
  }

  return <LivePokerTableForm onSubmit={handleCreateTable} />;
}
