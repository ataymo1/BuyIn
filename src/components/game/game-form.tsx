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
});

type GameFormValues = z.infer<typeof gameFormSchema>;

interface GameFormProps {
  onSubmit: (data: GameFormValues) => void | Promise<void>;
  defaultValues?: Partial<GameFormValues>;
  groups: Array<{ id: string; name: string }>;
  defaultGroupId?: string;
}

export function GameForm({
  onSubmit,
  defaultValues,
  groups,
  defaultGroupId,
}: GameFormProps) {
  const form = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: defaultValues || {
      groupId: defaultGroupId || "",
      date: new Date().toISOString().split("T")[0],
      location: "",
      gameType: "cash",
    },
  });

  const handleSubmit = async (data: GameFormValues) => {
    // Ensure only plain serializable data is passed
    await onSubmit({
      groupId: String(data.groupId),
      date: String(data.date),
      location: data.location ? String(data.location) : undefined,
      gameType: data.gameType,
    });
  };

  const isLoading = form.formState.isSubmitting;

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

          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="h-12 w-full bg-gradient-to-r from-violet-500 to-purple-600 font-semibold text-base text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-600 hover:to-purple-700 hover:text-white hover:shadow-violet-500/30 hover:shadow-xl"
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
