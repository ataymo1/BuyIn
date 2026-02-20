"use client";

import { Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GroupForm } from "@/components/group/group-form";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormFieldSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useConvexUser, useCreateGroup } from "@/lib/convex-hooks";

function NewGroupSkeleton() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent pb-12 pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 blur-3xl" />
        </div>
        <div className="container relative mx-auto max-w-2xl px-4">
          <Skeleton className="mb-6 h-8 w-40" />
          <div className="flex items-start gap-6">
            <Skeleton className="hidden sm:block h-16 w-16 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-96" />
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="overflow-hidden border-0 shadow-xl shadow-black/5">
          <CardHeader className="border-b bg-muted/30 pb-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <FormFieldSkeleton />
            <FormFieldSkeleton />
            <Skeleton className="mt-4 h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function NewGroupClient() {
  const router = useRouter();
  const { userId, isLoading } = useConvexUser();
  const createGroup = useCreateGroup();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  if (isLoading) {
    return <NewGroupSkeleton />;
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
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent pb-12 pt-6">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 blur-3xl" />
        </div>

        <div className="container relative mx-auto max-w-2xl px-4">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="font-bold text-3xl sm:text-4xl tracking-tight">
                Create a New Group
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Start a poker group to track sessions, manage buy-ins, and keep everyone's stats in one place.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <GroupForm onSubmit={handleCreateGroup} />
      </div>

      <PaymentInfoModal
        open={showPaymentModal}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
