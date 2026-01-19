"use client";

import { Loader2, UserPlus } from "lucide-react";
import { JoinRequestCard } from "@/components/group/join-request-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  useApproveRequest,
  useConvexUser,
  usePendingRequests,
  useRejectRequest,
} from "@/lib/convex-hooks";
import type { Id } from "../../../convex/_generated/dataModel";

interface PendingRequestsListProps {
  groupId: Id<"groups">;
}

export function PendingRequestsList({ groupId }: PendingRequestsListProps) {
  const { requests, isLoading } = usePendingRequests(groupId);
  const { userId } = useConvexUser();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  const handleApprove = async (requestId: Id<"joinRequests">) => {
    if (!userId) {
      return;
    }
    await approveRequest({ requestId, userId });
  };

  const handleReject = async (requestId: Id<"joinRequests">) => {
    if (!userId) {
      return;
    }
    await rejectRequest({ requestId, userId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <UserPlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No pending requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {requests.map((request) => (
        <JoinRequestCard
          key={request._id}
          message={request.message}
          onApprove={handleApprove}
          onReject={handleReject}
          requestedAt={request.requestedAt}
          requestId={request._id}
          userEmail={request.user?.email ?? "Unknown"}
          userImage={request.user?.image}
          userName={request.user?.name}
        />
      ))}
    </div>
  );
}
