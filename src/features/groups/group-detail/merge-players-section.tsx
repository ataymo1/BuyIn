"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { AlertTriangle, Merge } from "lucide-react";
import { useId, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface MergeCandidate {
  aliases: string[];
  gamesPlayed: number;
  name: string;
  playerId: Id<"players">;
  totalProfit: number;
}

function Profit({ value }: { value: number }) {
  return (
    <span className={value >= 0 ? "text-green-600" : "text-red-600"}>
      {value >= 0 ? "+" : ""}${value.toFixed(2)}
    </span>
  );
}

function sessionLabel(count: number) {
  return `${count} session${count === 1 ? "" : "s"}`;
}

function SessionLine({
  buyIn,
  cashOut,
  date,
  location,
  profit,
}: {
  buyIn: number;
  cashOut: number;
  date: number;
  location: string | null;
  profit: number;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 truncate">
        {date ? format(new Date(date), "MMM d, yyyy") : "Unknown date"}
        {location ? (
          <span className="text-muted-foreground"> · {location}</span>
        ) : null}
      </span>
      <span className="whitespace-nowrap text-muted-foreground">
        ${buyIn.toFixed(2)} in / ${cashOut.toFixed(2)} out ·{" "}
        <Profit value={profit} />
      </span>
    </li>
  );
}

function ChooseKeeperStep({
  candidates,
  name,
  onNameChange,
  onTargetChange,
  radioName,
  targetId,
}: {
  candidates: MergeCandidate[];
  name: string;
  onNameChange: (value: string) => void;
  onTargetChange: (playerId: Id<"players">) => void;
  radioName: string;
  targetId: Id<"players">;
}) {
  const nameInputId = useId();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-medium text-sm">Which player should be kept?</p>
        {candidates.map((candidate) => (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent"
            key={candidate.playerId}
          >
            <input
              checked={targetId === candidate.playerId}
              className="h-4 w-4 accent-primary"
              name={radioName}
              onChange={() => onTargetChange(candidate.playerId)}
              type="radio"
              value={candidate.playerId}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {candidate.name}
              </span>
              <span className="block text-muted-foreground text-sm">
                {sessionLabel(candidate.gamesPlayed)} · Net{" "}
                <Profit value={candidate.totalProfit} />
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor={nameInputId}>Combined player name</Label>
        <Input
          id={nameInputId}
          maxLength={80}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Player name"
          value={name}
        />
        <p className="text-muted-foreground text-xs">
          This is the name that will appear on the leaderboard. Anyone can still
          claim this history later.
        </p>
      </div>
    </div>
  );
}

function ConfirmStep({
  groupId,
  name,
  playerIds,
  userId,
}: {
  groupId: Id<"groups">;
  name: string;
  playerIds: Id<"players">[];
  userId: Id<"users">;
}) {
  const preview = useQuery(api.player_merges.getMergePreview, {
    groupId,
    playerIds,
    userId,
  });

  if (preview === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!preview) {
    return (
      <p className="text-destructive text-sm">
        Could not load these sessions. Close this dialog and try again.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {preview.sharedSessions.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">
              {sessionLabel(preview.sharedSessions.length)} include more than
              one of these players
            </p>
            <p className="text-muted-foreground">
              Their buy-ins and cash-outs will be added together into a single
              entry. Only continue if this really is one person.
            </p>
          </div>
        </div>
      ) : null}

      {preview.players.map((player) => (
        <div className="rounded-lg border p-3" key={player.playerId}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate font-medium">{player.name}</p>
            <p className="whitespace-nowrap text-muted-foreground text-sm">
              {sessionLabel(player.gamesPlayed)} · Net{" "}
              <Profit value={player.totalProfit} />
            </p>
          </div>
          {player.sessions.length > 0 ? (
            <ul className="space-y-1">
              {player.sessions.map((session) => (
                <SessionLine
                  buyIn={session.buyIn}
                  cashOut={session.cashOut}
                  date={session.date}
                  key={session.gameId}
                  location={session.location}
                  profit={session.profit}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No sessions in this group.
            </p>
          )}
        </div>
      ))}

      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="font-medium">Result: {name.trim() || "Unnamed player"}</p>
        <p className="text-muted-foreground text-sm">
          {sessionLabel(preview.combined.gamesPlayed)} · $
          {preview.combined.totalBuyIn.toFixed(2)} in / $
          {preview.combined.totalCashOut.toFixed(2)} out · Net{" "}
          <Profit value={preview.combined.totalProfit} />
        </p>
      </div>
    </div>
  );
}

function MergePlayersDialog({
  candidates,
  groupId,
  onMerged,
  onOpenChange,
  userId,
}: {
  candidates: MergeCandidate[];
  groupId: Id<"groups">;
  onMerged: () => void;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
}) {
  const mergePlayers = useMutation(api.player_merges.mergePlayers);
  const radioName = useId();

  const defaultTarget = useMemo(
    () =>
      [...candidates].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0] ??
      candidates[0],
    [candidates]
  );

  const [targetId, setTargetId] = useState<Id<"players">>(
    defaultTarget.playerId
  );
  const [name, setName] = useState(defaultTarget.name);
  const [isConfirming, setIsConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const playerIds = useMemo(
    () => candidates.map((candidate) => candidate.playerId),
    [candidates]
  );

  function selectTarget(playerId: Id<"players">) {
    setTargetId(playerId);
    const picked = candidates.find(
      (candidate) => candidate.playerId === playerId
    );
    if (picked) {
      setName(picked.name);
    }
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await mergePlayers({
        groupId,
        name: name.trim() || undefined,
        sourcePlayerIds: playerIds.filter((playerId) => playerId !== targetId),
        targetPlayerId: targetId,
        userId,
      });
      onMerged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Combine failed");
      setIsConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isConfirming
              ? "Confirm combining these sessions"
              : `Combine ${candidates.length} players`}
          </DialogTitle>
          <DialogDescription>
            {isConfirming
              ? "Check every session below before continuing. Combining cannot be undone."
              : "Pick the player to keep. Every other selected player's sessions move onto it."}
          </DialogDescription>
        </DialogHeader>

        {isConfirming ? (
          <ConfirmStep
            groupId={groupId}
            name={name}
            playerIds={playerIds}
            userId={userId}
          />
        ) : (
          <ChooseKeeperStep
            candidates={candidates}
            name={name}
            onNameChange={setName}
            onTargetChange={selectTarget}
            radioName={radioName}
            targetId={targetId}
          />
        )}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button
            onClick={() =>
              isConfirming ? setIsConfirming(false) : onOpenChange(false)
            }
            variant="outline"
          >
            {isConfirming ? "Back" : "Cancel"}
          </Button>
          {isConfirming ? (
            <Button disabled={saving} onClick={submit}>
              {saving ? "Combining..." : "Yes, combine them"}
            </Button>
          ) : (
            <Button onClick={() => setIsConfirming(true)}>
              Review sessions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MergePlayersSection({
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
  const [selected, setSelected] = useState<Id<"players">[]>([]);
  const [open, setOpen] = useState(false);

  const available = candidates ?? [];

  const selectedCandidates = useMemo(
    () =>
      available.filter((candidate) => selected.includes(candidate.playerId)),
    [available, selected]
  );

  if (available.length < 2) {
    return null;
  }

  function toggle(playerId: Id<"players">) {
    setSelected((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId]
    );
  }

  function handleMerged() {
    setOpen(false);
    setSelected([]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Merge className="h-5 w-5" />
          <CardTitle>Combine Duplicate Players</CardTitle>
        </div>
        <CardDescription>
          The same person can show up more than once when they play without an
          account. Select the entries that are one person to merge their history
          into a single leaderboard spot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {available.map((candidate) => (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-accent"
            key={candidate.playerId}
          >
            <input
              checked={selected.includes(candidate.playerId)}
              className="h-4 w-4 accent-primary"
              onChange={() => toggle(candidate.playerId)}
              type="checkbox"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {candidate.name}
              </span>
              <span className="block text-muted-foreground text-sm">
                {sessionLabel(candidate.gamesPlayed)} · Net{" "}
                <Profit value={candidate.totalProfit} />
              </span>
              {candidate.aliases.length > 0 ? (
                <span className="block truncate text-muted-foreground text-xs">
                  Ledger names: {candidate.aliases.join(", ")}
                </span>
              ) : null}
            </span>
          </label>
        ))}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-muted-foreground text-sm">
            {selected.length} selected
          </p>
          <Button disabled={selected.length < 2} onClick={() => setOpen(true)}>
            <Merge className="mr-2 h-4 w-4" />
            Combine selected
          </Button>
        </div>
      </CardContent>

      {open && selectedCandidates.length >= 2 ? (
        <MergePlayersDialog
          candidates={selectedCandidates}
          groupId={groupId}
          onMerged={handleMerged}
          onOpenChange={setOpen}
          userId={userId}
        />
      ) : null}
    </Card>
  );
}
