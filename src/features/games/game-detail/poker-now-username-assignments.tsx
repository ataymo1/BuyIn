"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, UserRoundCog } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvexUser } from "@/lib/convex-hooks";
import { parseLegacyPokerNowLog } from "@/lib/poker-now/legacy-log-parser";
import {
  type PokerNowSession,
  parsePokerNowLedger,
} from "@/lib/poker-now/parser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const EXCLUDE_PLAYER = "__exclude__";

interface PokerNowUsernameAssignmentsProps {
  currentPlayerIds: Id<"players">[];
  gameId: Id<"games">;
  groupId: Id<"groups">;
}

export function PokerNowUsernameAssignments({
  currentPlayerIds,
  gameId,
  groupId,
}: PokerNowUsernameAssignmentsProps) {
  const { userId } = useConvexUser();
  const mappings = useQuery(api.poker_now_imports.getSessionMappings, {
    gameId,
  });
  const candidates = useQuery(api.poker_now_imports.getCandidates, {
    groupId,
  });
  const updateMappings = useMutation(
    api.poker_now_imports.updateSessionMappings
  );
  const restoreMappings = useMutation(
    api.poker_now_imports.restoreSessionMappings
  );
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [originalAssignments, setOriginalAssignments] = useState<
    Record<string, Id<"players">>
  >({});
  const [recoverySession, setRecoverySession] = useState<PokerNowSession>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const members = (candidates?.players ?? []).filter(
    (candidate) => !candidate.isExtra
  );
  const memberIds = new Set(members.map((member) => String(member.id)));
  const currentPlayerIdSet = new Set(currentPlayerIds.map(String));
  const unclaimedPlayers = (candidates?.players ?? []).filter(
    (candidate) =>
      candidate.isExtra && currentPlayerIdSet.has(String(candidate.id))
  );
  const candidateIds = new Set([
    ...memberIds,
    ...unclaimedPlayers.map((player) => String(player.id)),
  ]);
  const editablePlayers =
    mappings && mappings.length > 0
      ? mappings.map((mapping) => ({
          sourcePlayerId: mapping.sourcePlayerId,
          displayName: mapping.displayName,
          playerId: mapping.playerId,
        }))
      : (recoverySession?.players.map((player) => ({
          sourcePlayerId: player.sourceId,
          displayName: player.name,
          playerId: undefined,
        })) ?? []);
  const selectedMemberIds = editablePlayers
    .map((player) => assignments[player.sourcePlayerId])
    .filter((playerId) => playerId && playerId !== EXCLUDE_PLAYER);
  const allAssigned = editablePlayers.every((player) => {
    const playerId = assignments[player.sourcePlayerId];
    return (
      memberIds.has(playerId) ||
      (!recoverySession && playerId === String(player.playerId)) ||
      (recoverySession !== undefined &&
        (candidateIds.has(playerId) || playerId === EXCLUDE_PLAYER))
    );
  });
  const canSave =
    editablePlayers.length > 0 &&
    allAssigned &&
    new Set(selectedMemberIds).size >= 2;

  function showEditor() {
    setRecoverySession(undefined);
    const currentAssignments = Object.fromEntries(
      (mappings ?? []).map((mapping) => [
        mapping.sourcePlayerId,
        mapping.playerId,
      ])
    );
    setOriginalAssignments(currentAssignments);
    setAssignments(currentAssignments);
    setError(undefined);
    setOpen(true);
  }

  async function readRecoveryLedger(file?: File) {
    if (!(file && candidates)) {
      return;
    }

    try {
      const text = await file.text();
      let session: PokerNowSession;
      try {
        session = parsePokerNowLedger(text, file.name);
      } catch (ledgerError) {
        try {
          session = parseLegacyPokerNowLog(text, file.name);
        } catch {
          throw ledgerError;
        }
      }
      const nextAssignments: Record<string, string> = {};
      for (const player of session.players) {
        const alias = candidates.aliases.find(
          (candidate) => candidate.sourcePlayerId === player.sourceId
        );
        if (alias && candidateIds.has(String(alias.playerId))) {
          nextAssignments[player.sourceId] = String(alias.playerId);
        }
      }
      setRecoverySession(session);
      setAssignments(nextAssignments);
      setError(undefined);
      setOpen(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not parse this file"
      );
    }
  }

  async function save() {
    if (!(userId && mappings && canSave)) {
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      if (recoverySession) {
        await restoreMappings({
          gameId,
          userId,
          sourceId: recoverySession.sourceId,
          players: recoverySession.players
            .filter((player) => assignments[player.sourceId] !== EXCLUDE_PLAYER)
            .map((player) => ({
              sourcePlayerId: player.sourceId,
              displayName: player.name,
              buyIn: player.buyIn,
              cashOut: player.cashOut,
              playerId: assignments[player.sourceId] as Id<"players">,
            })),
        });
        setRecoverySession(undefined);
      } else {
        await updateMappings({
          gameId,
          userId,
          mappings: mappings.map((mapping) => ({
            sourcePlayerId: mapping.sourcePlayerId,
            currentPlayerId: originalAssignments[mapping.sourcePlayerId],
            playerId: assignments[mapping.sourcePlayerId] as Id<"players">,
          })),
        });
      }
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update username assignments"
      );
    } finally {
      setSaving(false);
    }
  }

  if (mappings === undefined || candidates === undefined) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserRoundCog className="h-5 w-5" />
              PokerNow usernames
            </CardTitle>
            <CardDescription>
              Assign imported usernames to members of this group.
            </CardDescription>
          </div>
          {mappings.length > 0 ? (
            <Button onClick={showEditor} size="sm" variant="outline">
              Edit assignments
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {mappings.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {mappings.map((mapping) => {
                const player = candidates.players.find(
                  (candidate) => candidate.id === mapping.playerId
                );
                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    key={mapping.sourcePlayerId}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {mapping.displayName}
                    </span>
                    <span className="min-w-0 truncate text-muted-foreground">
                      {player?.name ?? "Unassigned"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                This session predates editable assignments. Upload its original
                PokerNow CSV to restore the usernames, then assign them to group
                members. Older imports can use the original game log.
              </p>
              <div className="max-w-sm space-y-2">
                <Label htmlFor="restore-poker-now-ledger">
                  Original PokerNow CSV
                </Label>
                <Input
                  accept=".csv,text/csv"
                  id="restore-poker-now-ledger"
                  onChange={(event) =>
                    readRecoveryLedger(event.target.files?.[0])
                  }
                  type="file"
                />
              </div>
              {error && !open ? (
                <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {recoverySession
                ? "Restore PokerNow username assignments"
                : "Edit PokerNow username assignments"}
            </DialogTitle>
            <DialogDescription>
              Assigning a username moves its imported buy-ins, cash-outs, and
              session results to the selected member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editablePlayers.map((player) => (
              <div className="space-y-2" key={player.sourcePlayerId}>
                <Label htmlFor={`poker-now-${player.sourcePlayerId}`}>
                  {player.displayName}
                </Label>
                <Select
                  onValueChange={(playerId) =>
                    setAssignments((current) => ({
                      ...current,
                      [player.sourcePlayerId]: playerId,
                    }))
                  }
                  value={assignments[player.sourcePlayerId]}
                >
                  <SelectTrigger id={`poker-now-${player.sourcePlayerId}`}>
                    <SelectValue placeholder="Select a group member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                        {member.email ? ` · ${member.email}` : ""}
                      </SelectItem>
                    ))}
                    {recoverySession
                      ? unclaimedPlayers.map((unclaimed) => (
                          <SelectItem key={unclaimed.id} value={unclaimed.id}>
                            {unclaimed.name} · unclaimed
                          </SelectItem>
                        ))
                      : null}
                    {!recoverySession &&
                    player.playerId &&
                    !memberIds.has(String(player.playerId)) ? (
                      <SelectItem value={player.playerId}>
                        Keep as unclaimed player
                      </SelectItem>
                    ) : null}
                    {recoverySession ? (
                      <SelectItem value={EXCLUDE_PLAYER}>
                        Exclude from this session
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {error ? (
              <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </p>
            ) : null}
            {canSave ? null : (
              <p className="text-muted-foreground text-sm">
                Assign or exclude every username and keep at least two different
                players in the session.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={saving}
              onClick={() => setOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={saving || !canSave} onClick={save}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
