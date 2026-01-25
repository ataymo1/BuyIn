"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
    },
  });

  const handleSubmit = async (data: GameFormValues) => {
    // Ensure only plain serializable data is passed
    await onSubmit({
      groupId: String(data.groupId),
      date: String(data.date),
      location: data.location ? String(data.location) : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Game</CardTitle>
        <CardDescription>Add a new poker game session</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="groupId">Group</Label>
            <Select
              onValueChange={(value) => form.setValue("groupId", value)}
              value={form.watch("groupId")}
            >
              <SelectTrigger>
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
              <p className="text-destructive text-sm">
                {form.formState.errors.groupId.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...form.register("date")} />
            {form.formState.errors.date && (
              <p className="text-destructive text-sm">
                {form.formState.errors.date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              placeholder="e.g., Home, Casino, Friend's house"
              {...form.register("location")}
            />
          </div>
          <Button disabled={form.formState.isSubmitting} type="submit">
            {form.formState.isSubmitting ? "Creating..." : "Create Game"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
