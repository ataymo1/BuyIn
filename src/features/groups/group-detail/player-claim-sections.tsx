"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, History, Link2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ClaimCandidate {
  aliases: string[];
  gamesPlayed: number;
  name: string;
  playerId: Id<"players">;
  totalProfit: number;
}

function Profit({ value }: { value: number }) {
  return (
    <span
      className={
        value >= 0
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      }
    >
      {value >= 0 ? "+" : ""}${value.toFixed(2)}
    </span>
  );
}

function ClaimHistoryDialog({
  candidate,
  groupId,
  userId,
}: {
  candidate: ClaimCandidate;
  groupId: Id<"groups">;
  userId: Id<"users">;
}) {
  const submitClaim = useMutation(api.player_claims.submitClaim);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await submitClaim({
        groupId,
        userId,
        sourcePlayerId: candidate.playerId,
      });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Claim failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 className="mr-2 h-4 w-4" />
          This is me
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim {candidate.name}&apos;s history?</DialogTitle>
          <DialogDescription>
            This requests to connect {candidate.gamesPlayed} past session
            {candidate.gamesPlayed === 1 ? "" : "s"} to your account. This is a
            separate request that the group leader must approve before your
            stats change.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? "Requesting..." : "Request claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClaimPlayerHistorySection({
  groupId,
  userId,
}: {
  groupId: Id<"groups">;
  userId: Id<"users">;
}) {
  const candidates = useQuery(api.player_claims.getClaimablePlayers, {
    groupId,
    userId,
  });

  if (!candidates?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <CardTitle>Claim Past Sessions</CardTitle>
        </div>
        <CardDescription>
          New to this group? Request to connect sessions from before you
          joined. The group leader will review it separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate) => (
          <div
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            key={candidate.playerId}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{candidate.name}</p>
              <p className="text-muted-foreground text-sm">
                {candidate.gamesPlayed} session
                {candidate.gamesPlayed === 1 ? "" : "s"} · Net{" "}
                <Profit value={candidate.totalProfit} />
              </p>
              {candidate.aliases.length > 0 ? (
                <p className="truncate text-muted-foreground text-xs">
                  Ledger names: {candidate.aliases.join(", ")}
                </p>
              ) : null}
            </div>
            <ClaimHistoryDialog
              candidate={candidate}
              groupId={groupId}
              userId={userId}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PendingPlayerClaimsSection({
  groupId,
  userId,
}: {
  groupId: Id<"groups">;
  userId: Id<"users">;
}) {
  const claims = useQuery(api.player_claims.getPendingClaims, {
    groupId,
    userId,
  });
  const respond = useMutation(api.player_claims.respondToClaim);
  const [respondingTo, setRespondingTo] = useState<Id<"playerClaimRequests">>();
  const [error, setError] = useState<string>();

  if (!claims?.length) {
    return null;
  }

  async function respondToClaim(
    requestId: Id<"playerClaimRequests">,
    approve: boolean
  ) {
    setRespondingTo(requestId);
    setError(undefined);
    try {
      await respond({ requestId, userId, approve });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed");
    } finally {
      setRespondingTo(undefined);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Player Claims</CardTitle>
        <CardDescription>
          Confirm that these old session entries belong to the member requesting
          them. Approval permanently combines their group history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {claims.map((claim) => (
          <div
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            key={claim._id}
          >
            <div>
              <p className="font-medium">
                {claim.claimantName} wants to claim {claim.sourceName}
              </p>
              <p className="text-muted-foreground text-sm">
                {claim.gamesPlayed} session
                {claim.gamesPlayed === 1 ? "" : "s"} · Net{" "}
                <Profit value={claim.totalProfit} />
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={respondingTo === claim._id}
                onClick={() => respondToClaim(claim._id, false)}
                size="sm"
                variant="outline"
              >
                <X className="mr-1 h-4 w-4" />
                Reject
              </Button>
              <Button
                disabled={respondingTo === claim._id}
                onClick={() => respondToClaim(claim._id, true)}
                size="sm"
              >
                <Check className="mr-1 h-4 w-4" />
                Approve and combine
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
