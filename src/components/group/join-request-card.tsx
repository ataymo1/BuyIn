"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Id } from "../../../convex/_generated/dataModel";

interface JoinRequestCardProps {
  requestId: Id<"joinRequests">;
  userName: string | undefined;
  userEmail: string;
  userImage?: string;
  requestedAt: number;
  message?: string;
  onApprove: (requestId: Id<"joinRequests">) => Promise<void>;
  onReject: (requestId: Id<"joinRequests">) => Promise<void>;
}

export function JoinRequestCard({
  requestId,
  userName,
  userEmail,
  requestedAt,
  message,
  onApprove,
  onReject,
}: JoinRequestCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(requestId);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(requestId);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{userName ?? userEmail}</CardTitle>
        <CardDescription>
          Requested {formatDistanceToNow(new Date(requestedAt))} ago
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message && (
          <p className="mb-4 text-muted-foreground text-sm">"{message}"</p>
        )}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={isApproving || isRejecting}
            onClick={handleApprove}
            size="sm"
          >
            {isApproving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            className="flex-1"
            disabled={isApproving || isRejecting}
            onClick={handleReject}
            size="sm"
            variant="outline"
          >
            {isRejecting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-1 h-4 w-4" />
            )}
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
