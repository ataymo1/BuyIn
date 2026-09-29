"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronsUpDown,
  FileUp,
  Loader2,
  Trash2,
  Undo2,
  UserPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PokerNowImportWarnings } from "@/components/poker-now-import-warnings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvexUser, useUserGroups } from "@/lib/convex-hooks";
import {
  type PokerNowSession,
  parsePokerNowLedger,
} from "@/lib/poker-now/parser";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const CREATE_EXTRA = "__extra__";
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

interface PlayerCandidate {
  email?: string;
  id: Id<"players">;
  isExtra: boolean;
  name: string;
}

function PlayerCandidateItem({
  candidate,
  onSelect,
  selected,
}: {
  candidate: PlayerCandidate;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <CommandItem
      keywords={
        candidate.email ? [candidate.name, candidate.email] : [candidate.name]
      }
      onSelect={onSelect}
      value={candidate.id}
    >
      <Check
        className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")}
      />
      <span className="min-w-0">
        <span className="block truncate">{candidate.name}</span>
        {candidate.email ? (
          <span className="block truncate text-muted-foreground text-xs">
            {candidate.email}
          </span>
        ) : null}
      </span>
    </CommandItem>
  );
}

function PlayerCombobox({
  candidates,
  extraName,
  importedName,
  onChange,
  value,
}: {
  candidates: PlayerCandidate[];
  extraName: string;
  importedName: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = candidates.find((candidate) => candidate.id === value);
  const groupPlayers = candidates.filter((candidate) => !candidate.isExtra);
  const extraPlayers = candidates.filter((candidate) => candidate.isExtra);
  let label = selected?.name ?? "Select a player";
  if (value === CREATE_EXTRA) {
    label = `Add as extra player “${extraName.trim() || importedName}”`;
  }

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-full justify-between font-normal"
          role="combobox"
          variant="outline"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder="Search players..." />
          <CommandList>
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup heading="Group players">
              {groupPlayers.map((candidate) => (
                <PlayerCandidateItem
                  candidate={candidate}
                  key={candidate.id}
                  onSelect={() => select(candidate.id)}
                  selected={value === candidate.id}
                />
              ))}
            </CommandGroup>
            {extraPlayers.length > 0 ? (
              <CommandGroup
                className="border-t"
                heading="Unclaimed players from past sessions"
              >
                {extraPlayers.map((candidate) => (
                  <PlayerCandidateItem
                    candidate={candidate}
                    key={candidate.id}
                    onSelect={() => select(candidate.id)}
                    selected={value === candidate.id}
                  />
                ))}
              </CommandGroup>
            ) : null}
            <CommandGroup
              className="border-t bg-muted/30"
              heading="Other options"
            >
              <CommandItem
                className="py-2.5"
                keywords={[importedName, extraName, "extra", "new"]}
                onSelect={() => select(CREATE_EXTRA)}
                value={CREATE_EXTRA}
              >
                <UserPlus className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    Add “{extraName.trim() || importedName}” as an extra player
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    Keep this entry without linking an account
                  </span>
                </span>
                <Check
                  className={cn(
                    "ml-2 h-4 w-4 shrink-0",
                    value === CREATE_EXTRA ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PokerNowImportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useConvexUser();
  const { groups, isLoading } = useUserGroups();
  const [groupId, setGroupId] = useState(searchParams.get("groupId") ?? "");
  const [session, setSession] = useState<PokerNowSession>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [extraNames, setExtraNames] = useState<Record<string, string>>({});
  const [removedPlayerIds, setRemovedPlayerIds] = useState<Set<string>>(
    new Set()
  );
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
      const parsed = parsePokerNowLedger(await file.text(), file.name);
      const nextMapping: Record<string, string> = {};
      const nextExtraNames: Record<string, string> = {};
      for (const imported of parsed.players) {
        nextExtraNames[imported.sourceId] = imported.name;
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
      setRemovedPlayerIds(new Set());
      setSession(parsed);
      setMapping(nextMapping);
      setExtraNames(nextExtraNames);
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
    const invalidExtra = includedPlayers.some(
      (player) =>
        mapping[player.sourceId] === CREATE_EXTRA &&
        !(extraNames[player.sourceId] ?? "").trim()
    );
    if (invalidExtra) {
      setError("Every extra player needs a name");
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
        players: includedPlayers.map((player) => ({
          sourcePlayerId: player.sourceId,
          displayName:
            mapping[player.sourceId] === CREATE_EXTRA
              ? (extraNames[player.sourceId] ?? player.name).trim()
              : player.name,
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
      setRemovedPlayerIds(new Set());
      setMapping({});
      setExtraNames({});
      setSaving(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
      setSaving(false);
    }
  }

  const includedPlayers =
    session?.players.filter(
      (player) => !removedPlayerIds.has(player.sourceId)
    ) ?? [];
  const removedPlayers =
    session?.players.filter((player) =>
      removedPlayerIds.has(player.sourceId)
    ) ?? [];
  const includedPlayerCount = new Set(
    includedPlayers.map((player) => {
      const target = mapping[player.sourceId] ?? CREATE_EXTRA;
      return target === CREATE_EXTRA ? `extra:${player.sourceId}` : target;
    })
  ).size;
  const hasInvalidExtraNames = includedPlayers.some(
    (player) =>
      mapping[player.sourceId] === CREATE_EXTRA &&
      !(extraNames[player.sourceId] ?? "").trim()
  );

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-xl bg-violet-600 p-3 text-white">
          <FileUp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-3xl">Import PokerNow session</h1>
          <p className="text-muted-foreground">
            Upload a PokerNow ledger, match its names, and create a completed
            session.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ledger and group</CardTitle>
          <CardDescription>
            In PokerNow, open Ledger and download the CSV. The file stays in
            your browser until you confirm the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Group</Label>
            <Select
              onValueChange={(value) => {
                setGroupId(value);
                setSession(undefined);
                setRemovedPlayerIds(new Set());
                setMapping({});
                setExtraNames({});
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
            <Label htmlFor="pokerNowLedger">PokerNow ledger CSV</Label>
            <Input
              accept=".csv,text/csv"
              disabled={!groupId || isLoading}
              id="pokerNowLedger"
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
            <CardTitle>Review players</CardTitle>
            <CardDescription>
              Match each entry to a player. Remove duplicates or anyone who
              didn’t play before creating the session.
            </CardDescription>
            <CardDescription>
              {includedPlayers.length} of {session.players.length} entries
              included · {includedPlayerCount} players ·{" "}
              {new Date(session.startedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PokerNowImportWarnings
              warnings={session.warnings?.filter(
                (warning) => !removedPlayerIds.has(warning.sourcePlayerId ?? "")
              )}
            />
            {includedPlayers.map((player) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
                key={player.sourceId}
              >
                <div>
                  <p className="break-words font-medium">{player.name}</p>
                  <p className="flex flex-wrap gap-x-3 text-muted-foreground text-sm tabular-nums">
                    <span className="whitespace-nowrap">
                      Buy-in ${player.buyIn.toFixed(2)}
                    </span>
                    <span className="whitespace-nowrap">
                      Cash-out ${player.cashOut.toFixed(2)}
                    </span>
                  </p>
                </div>
                <Button
                  aria-label={`Remove ${player.name} from import`}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:col-start-3 sm:row-start-1"
                  disabled={saving}
                  onClick={() =>
                    setRemovedPlayerIds((current) =>
                      new Set(current).add(player.sourceId)
                    )
                  }
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
                <div className="col-span-2 min-w-0 space-y-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <PlayerCombobox
                    candidates={candidates?.players ?? []}
                    extraName={extraNames[player.sourceId] ?? player.name}
                    importedName={player.name}
                    onChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [player.sourceId]: value,
                      }))
                    }
                    value={mapping[player.sourceId] ?? CREATE_EXTRA}
                  />
                  {mapping[player.sourceId] === CREATE_EXTRA ? (
                    <div className="space-y-1">
                      <Label htmlFor={`extra-name-${player.sourceId}`}>
                        Extra player name
                      </Label>
                      <Input
                        id={`extra-name-${player.sourceId}`}
                        maxLength={80}
                        onChange={(event) =>
                          setExtraNames((current) => ({
                            ...current,
                            [player.sourceId]: event.target.value,
                          }))
                        }
                        placeholder="Enter a name"
                        value={extraNames[player.sourceId] ?? player.name}
                      />
                      {(extraNames[player.sourceId] ?? "").trim() ? (
                        <p className="text-muted-foreground text-xs">
                          This can be anyone, even if they have not joined the
                          group yet.
                        </p>
                      ) : (
                        <p className="text-destructive text-xs">
                          Enter a name for this extra player.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {removedPlayers.length > 0 ? (
              <section
                aria-label="Removed from import"
                className="rounded-lg border border-dashed bg-muted/20 p-4"
              >
                <p className="font-medium text-sm">
                  Removed from import · {removedPlayers.length}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  These entries won’t count toward player stats or session
                  totals.
                </p>
                <ul className="mt-3 divide-y">
                  {removedPlayers.map((player) => (
                    <li
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      key={player.sourceId}
                    >
                      <span className="min-w-0 break-words text-muted-foreground text-sm">
                        {player.name}
                      </span>
                      <Button
                        aria-label={`Undo removal of ${player.name}`}
                        disabled={saving}
                        onClick={() =>
                          setRemovedPlayerIds((current) => {
                            const next = new Set(current);
                            next.delete(player.sourceId);
                            return next;
                          })
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <Undo2 aria-hidden="true" />
                        Undo
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <output aria-live="polite" className="sr-only">
              {includedPlayers.length} entries included. {removedPlayers.length}{" "}
              removed.
            </output>
            <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Total buy-in</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  $
                  {includedPlayers
                    .reduce((total, player) => total + player.buyIn, 0)
                    .toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total cash-out</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  $
                  {includedPlayers
                    .reduce((total, player) => total + player.cashOut, 0)
                    .toFixed(2)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              {includedPlayerCount < 2 ? (
                <p className="text-destructive text-sm">
                  Include at least two different players.
                </p>
              ) : (
                <span />
              )}
              <Button
                disabled={
                  saving || includedPlayerCount < 2 || hasInvalidExtraNames
                }
                onClick={submit}
              >
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
