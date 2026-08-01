"use client";

import { useMutation, useQuery } from "convex/react";
import { FileUp, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvexUser, useUserGroups } from "@/lib/convex-hooks";
import { type PokerNowSession, parsePokerNowLog } from "@/lib/poker-now/parser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const CREATE_EXTRA = "__extra__";
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function PokerNowImportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useConvexUser();
  const { groups, isLoading } = useUserGroups();
  const [groupId, setGroupId] = useState(searchParams.get("groupId") ?? "");
  const [session, setSession] = useState<PokerNowSession>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [saving, setSaving] = useState(false);
  const candidates = useQuery(
    api.poker_now_imports.getCandidates,
    groupId ? { groupId: groupId as Id<"groups"> } : "skip"
  );
  const createSession = useMutation(api.poker_now_imports.createSession);

  async function readFile(file?: File) {
    if (!file) {
      return;
    }
    try {
      const parsed = parsePokerNowLog(await file.text(), file.name);
      const nextMapping: Record<string, string> = {};
      for (const imported of parsed.players) {
        const alias = candidates?.aliases.find(
          (item) => item.sourcePlayerId === imported.sourceId
        );
        const nameMatch = candidates?.players.find(
          (item) => normalize(item.name) === normalize(imported.name)
        );
        nextMapping[imported.sourceId] = String(
          alias?.playerId ?? nameMatch?.id ?? CREATE_EXTRA
        );
      }
      setSession(parsed);
      setMapping(nextMapping);
      setError(undefined);
    } catch (caught) {
      setSession(undefined);
      setError(
        caught instanceof Error ? caught.message : "Could not parse this file"
      );
    }
  }

  async function submit() {
    if (!(session && groupId && userId)) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const result = await createSession({
        groupId: groupId as Id<"groups">,
        createdById: userId,
        sourceId: session.sourceId,
        date: session.startedAt,
        smallBlind: session.smallBlind,
        bigBlind: session.bigBlind,
        handCount: session.handCount,
        players: session.players.map((player) => ({
          sourcePlayerId: player.sourceId,
          displayName: player.name,
          buyIn: player.buyIn,
          cashOut: player.cashOut,
          playerId:
            mapping[player.sourceId] &&
            mapping[player.sourceId] !== CREATE_EXTRA
              ? (mapping[player.sourceId] as Id<"players">)
              : undefined,
        })),
      });
      if (result.status === "APPROVED") {
        router.push(`/games/${result.gameId}`);
        return;
      }
      setSuccess("Import sent to the group leader for approval.");
      setSession(undefined);
      setSaving(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-xl bg-violet-600 p-3 text-white">
          <FileUp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-3xl">Import PokerNow session</h1>
          <p className="text-muted-foreground">
            Upload a PokerNow CSV, match its names, and create a completed
            session.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Log and group</CardTitle>
          <CardDescription>
            The file stays in your browser until you confirm the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Group</Label>
            <Select
              onValueChange={(value) => {
                setGroupId(value);
                setSession(undefined);
              }}
              value={groupId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.filter(Boolean).map((group) => (
                  <SelectItem key={group?._id} value={group?._id ?? ""}>
                    {group?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pokerNowLog">PokerNow CSV log</Label>
            <Input
              accept=".csv,text/csv"
              disabled={!groupId || isLoading}
              id="pokerNowLog"
              onChange={(event) => readFile(event.target.files?.[0])}
              type="file"
            />
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md bg-green-500/10 p-3 text-green-700 text-sm dark:text-green-400">
              {success}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {session ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Match players</CardTitle>
            <CardDescription>
              {session.players.length} players · {session.handCount} hands ·{" "}
              {new Date(session.startedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.players.map((player) => (
              <div
                className="grid gap-2 rounded-lg border p-4 sm:grid-cols-[1fr_1.4fr] sm:items-center"
                key={player.sourceId}
              >
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-muted-foreground text-sm">
                    Buy-in ${player.buyIn.toFixed(2)} · Cash-out $
                    {player.cashOut.toFixed(2)}
                  </p>
                </div>
                <Select
                  onValueChange={(value) =>
                    setMapping((current) => ({
                      ...current,
                      [player.sourceId]: value,
                    }))
                  }
                  value={mapping[player.sourceId] ?? CREATE_EXTRA}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CREATE_EXTRA}>
                      Add as extra player “{player.name}”
                    </SelectItem>
                    {candidates?.players.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button disabled={saving} onClick={submit}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" />
                )}
                Create completed session
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
