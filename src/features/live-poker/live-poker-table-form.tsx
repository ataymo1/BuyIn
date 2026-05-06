"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RadioTower } from "lucide-react";
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

const livePokerTableFormSchema = z.object({
  title: z.string().min(1, "Table name is required"),
  smallBlind: z.string().min(1, "Small blind is required"),
  bigBlind: z.string().min(1, "Big blind is required"),
  minBuyIn: z.string().min(1, "Min buy-in is required"),
  maxBuyIn: z.string().min(1, "Max buy-in is required"),
  seatCount: z.string().min(1, "Seat count is required"),
});

export type LivePokerTableFormValues = z.infer<typeof livePokerTableFormSchema>;

interface LivePokerTableFormProps {
  onSubmit: (data: LivePokerTableFormValues) => void | Promise<void>;
}

export function LivePokerTableForm({ onSubmit }: LivePokerTableFormProps) {
  const form = useForm<LivePokerTableFormValues>({
    resolver: zodResolver(livePokerTableFormSchema),
    defaultValues: {
      title: "No-Limit Hold'em",
      smallBlind: "1",
      bigBlind: "2",
      minBuyIn: "20",
      maxBuyIn: "400",
      seatCount: "6",
    },
  });

  const isLoading = form.formState.isSubmitting;

  return (
    <Card className="overflow-hidden border-0 shadow-black/5 shadow-xl">
      <CardHeader className="border-b bg-muted/30 pb-6">
        <CardTitle className="text-xl">Live Table</CardTitle>
        <CardDescription>
          Create a public signed-in poker table anyone can join.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="title">
              Table Name
            </Label>
            <Input
              className="h-12 text-base"
              id="title"
              placeholder="Friday Night NLH"
              {...form.register("title")}
            />
          </div>

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

          <Button
            className="h-12 w-full font-semibold text-base"
            disabled={isLoading}
            size="lg"
            type="submit"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <RadioTower className="mr-2 h-5 w-5" />
            )}
            Create Live Table
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
