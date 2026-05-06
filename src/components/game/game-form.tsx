"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const gameFormSchema = z.object({
  groupId: z.string().min(1, "Group is required"),
  date: z.string().min(1, "Date is required"),
  location: z.string().optional(),
  gameType: z.enum(["cash", "tournament"]).optional(),
  livePokerEnabled: z.boolean().optional(),
  smallBlind: z.string().optional(),
  bigBlind: z.string().optional(),
  minBuyIn: z.string().optional(),
  maxBuyIn: z.string().optional(),
  seatCount: z.string().optional(),
});

type GameFormValues = z.infer<typeof gameFormSchema>;

interface GameFormProps {
  onSubmit: (data: GameFormValues) => void | Promise<void>;
  defaultValues?: Partial<GameFormValues>;
  groups: Array<{ id: string; name: string }>;
  defaultGroupId?: string;
  showLivePokerFields?: boolean;
}

export function GameForm({
  onSubmit,
  defaultValues,
  groups,
  defaultGroupId,
  showLivePokerFields = false,
}: GameFormProps) {
  const form = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: defaultValues || {
      groupId: defaultGroupId || "",
      date: new Date().toISOString().split("T")[0],
      location: "",
      gameType: "cash",
      livePokerEnabled: false,
      smallBlind: "1",
      bigBlind: "2",
      minBuyIn: "20",
      maxBuyIn: "400",
      seatCount: "6",
    },
  });

  const handleSubmit = async (data: GameFormValues) => {
    // Ensure only plain serializable data is passed
    await onSubmit({
      groupId: String(data.groupId),
      date: String(data.date),
      location: data.location ? String(data.location) : undefined,
      gameType: data.gameType,
      livePokerEnabled: showLivePokerFields && Boolean(data.livePokerEnabled),
      smallBlind: data.smallBlind,
      bigBlind: data.bigBlind,
      minBuyIn: data.minBuyIn,
      maxBuyIn: data.maxBuyIn,
      seatCount: data.seatCount,
    });
  };

  const isLoading = form.formState.isSubmitting;
  const gameType = form.watch("gameType") || "cash";
  const livePokerEnabled =
    showLivePokerFields && Boolean(form.watch("livePokerEnabled"));

  return (
    <Card className="overflow-hidden border-0 shadow-black/5 shadow-xl">
      <CardHeader className="border-b bg-muted/30 pb-6">
        <CardTitle className="text-xl">Session Details</CardTitle>
        <CardDescription>
          Set up your poker session with the details below
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="groupId">
              Group <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(value) => form.setValue("groupId", value)}
              value={form.watch("groupId")}
            >
              <SelectTrigger className="h-12 text-base transition-all focus:ring-2 focus:ring-violet-500/20">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.groupId && (
              <p className="flex items-center gap-1 text-destructive text-sm">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.groupId.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              className="h-12 text-base transition-all focus:ring-2 focus:ring-violet-500/20"
              id="date"
              type="date"
              {...form.register("date")}
            />
            {form.formState.errors.date && (
              <p className="flex items-center gap-1 text-destructive text-sm">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="location">
              Location{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              className="h-12 text-base transition-all focus:ring-2 focus:ring-violet-500/20"
              id="location"
              placeholder="e.g., Home, Casino, Friend's house"
              {...form.register("location")}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="gameType">
              Game Type
            </Label>
            <Select
              onValueChange={(value) =>
                form.setValue("gameType", value as "cash" | "tournament")
              }
              value={form.watch("gameType") || "cash"}
            >
              <SelectTrigger className="h-12 text-base transition-all focus:ring-2 focus:ring-violet-500/20">
                <SelectValue placeholder="Select game type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash Game</SelectItem>
                <SelectItem value="tournament">Tournament</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showLivePokerFields ? (
            <div className="rounded-lg border p-4">
              <label
                className="flex items-start gap-3"
                htmlFor="livePokerEnabled"
              >
                <input
                  className="mt-1 h-4 w-4 accent-violet-600"
                  disabled={gameType === "tournament"}
                  id="livePokerEnabled"
                  type="checkbox"
                  {...form.register("livePokerEnabled")}
                />
                <span className="space-y-1">
                  <span className="block font-medium text-sm">
                    Enable live poker table
                  </span>
                  <span className="block text-muted-foreground text-sm">
                    Create a realtime cash table with seats, cards, betting, and
                    hand flow.
                  </span>
                </span>
              </label>
              {gameType === "tournament" ? (
                <p className="mt-2 text-muted-foreground text-xs">
                  Live poker is available for cash games in this version.
                </p>
              ) : null}
            </div>
          ) : null}

          {livePokerEnabled && gameType === "cash" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-medium text-sm" htmlFor="smallBlind">
                  Small Blind
                </Label>
                <Input
                  className="h-12"
                  id="smallBlind"
                  min="0.01"
                  step="0.01"
                  type="number"
                  {...form.register("smallBlind")}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-sm" htmlFor="bigBlind">
                  Big Blind
                </Label>
                <Input
                  className="h-12"
                  id="bigBlind"
                  min="0.01"
                  step="0.01"
                  type="number"
                  {...form.register("bigBlind")}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-sm" htmlFor="minBuyIn">
                  Min Buy-in
                </Label>
                <Input
                  className="h-12"
                  id="minBuyIn"
                  min="0"
                  step="0.01"
                  type="number"
                  {...form.register("minBuyIn")}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium text-sm" htmlFor="maxBuyIn">
                  Max Buy-in
                </Label>
                <Input
                  className="h-12"
                  id="maxBuyIn"
                  min="0"
                  step="0.01"
                  type="number"
                  {...form.register("maxBuyIn")}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="font-medium text-sm" htmlFor="seatCount">
                  Seats
                </Label>
                <Input
                  className="h-12"
                  id="seatCount"
                  max="9"
                  min="2"
                  step="1"
                  type="number"
                  {...form.register("seatCount")}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="h-12 w-full bg-gradient-to-r from-violet-500 to-purple-600 font-semibold text-base shadow-lg shadow-violet-500/25 transition-all hover:from-violet-600 hover:to-purple-700 hover:shadow-violet-500/30 hover:shadow-xl"
              disabled={isLoading}
              size="lg"
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating session...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Session
                </>
              )}
            </Button>
            <p className="text-center text-muted-foreground text-xs">
              You'll be the banker and can add players after creating
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
