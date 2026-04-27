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
    <Card className="overflow-hidden border-0 shadow-xl shadow-black/5">
      <CardHeader className="border-b bg-muted/30 pb-6">
        <CardTitle className="text-xl">Session Details</CardTitle>
        <CardDescription>
          Set up your poker session with the details below
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="groupId" className="text-sm font-medium">
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
              <p className="text-destructive text-sm flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.groupId.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input 
              id="date" 
              type="date" 
              className="h-12 text-base transition-all focus:ring-2 focus:ring-violet-500/20"
              {...form.register("date")} 
            />
            {form.formState.errors.date && (
              <p className="text-destructive text-sm flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium">
              Location <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="location"
              placeholder="e.g., Home, Casino, Friend's house"
              className="h-12 text-base transition-all focus:ring-2 focus:ring-violet-500/20"
              {...form.register("location")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gameType" className="text-sm font-medium">
              Game Type
            </Label>
            <Select
              onValueChange={(value) => form.setValue("gameType", value as "cash" | "tournament")}
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
              disabled={isLoading}
              type="submit"
              size="lg"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30"
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
            <p className="text-center text-xs text-muted-foreground">
              You'll be the banker and can add players after creating
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
