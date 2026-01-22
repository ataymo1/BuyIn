"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GroupForm } from "@/components/group/group-form";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
import { useConvexUser, useCreateGroup } from "@/lib/convex-hooks";

export function NewGroupClient() {
  const router = useRouter();
  const { userId, isLoading } = useConvexUser();
  const createGroup = useCreateGroup();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function handleCreateGroup(data: {
    name: string;
    description?: string;
  }) {
    console.log("[handleCreateGroup] Starting with data:", data);
    console.log("[handleCreateGroup] userId:", userId);

    if (!userId) {
      console.error(
        "[handleCreateGroup] No userId - user is not authenticated"
      );
      throw new Error("Unauthorized - Please sign in to create a group");
    }

    if (!data.name || data.name.trim().length === 0) {
      console.error("[handleCreateGroup] Group name is empty");
      throw new Error("Group name is required");
    }

    try {
      console.log("[handleCreateGroup] Calling createGroup mutation...");
      const groupId = await createGroup({
        name: data.name.trim(),
        description: data.description?.trim(),
        ownerId: userId,
      });
      console.log("[handleCreateGroup] Group created successfully:", groupId);

      setPendingGroupId(groupId);
      setShowPaymentModal(true);
    } catch (error) {
      console.error("[handleCreateGroup] Error creating group:", error);
      throw error;
    }
  }

  function handlePaymentSuccess() {
    setShowPaymentModal(false);
    if (pendingGroupId) {
      router.push(`/groups/${pendingGroupId}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="font-bold text-3xl">New Group</h1>
          <p className="text-muted-foreground">Create a new poker group</p>
        </div>
      </div>
      <GroupForm onSubmit={handleCreateGroup} />

      <PaymentInfoModal
        open={showPaymentModal}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
