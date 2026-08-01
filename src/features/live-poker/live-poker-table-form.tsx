"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RadioTower } from "lucide-react";
import { useForm } from "react-hook-form";
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
  type LivePokerTableFormInput,
  type LivePokerTableFormValues,
  livePokerTableFormSchema,
} from "@/lib/live-poker/table-form-schema";

export type { LivePokerTableFormValues } from "@/lib/live-poker/table-form-schema";

interface LivePokerTableFormProps {
  onSubmit: (data: LivePokerTableFormValues) => void | Promise<void>;
  submitError?: string | null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-destructive text-sm" id={id}>
      {message}
    </p>
  );
}

export function LivePokerTableForm({
  onSubmit,
  submitError,
}: LivePokerTableFormProps) {
  const form = useForm<
    LivePokerTableFormInput,
    unknown,
    LivePokerTableFormValues
  >({
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

  const { errors, isSubmitting } = form.formState;

  return (
    <Card className="overflow-hidden border-0 shadow-black/5 shadow-xl">
      <CardHeader className="border-b bg-muted/30 pb-6">
        <CardTitle className="text-xl">Live Table</CardTitle>
        <CardDescription>
          Create a public signed-in poker table anyone can join.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form
          className="space-y-6"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="title">
              Table Name
            </Label>
            <Input
              aria-describedby={errors.title ? "title-error" : undefined}
              aria-invalid={Boolean(errors.title)}
              className="h-12 text-base"
              id="title"
              placeholder="Friday Night NLH"
              {...form.register("title")}
            />
            <FieldError id="title-error" message={errors.title?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-medium text-sm" htmlFor="smallBlind">
                Small Blind
              </Label>
              <Input
                aria-describedby={
                  errors.smallBlind ? "smallBlind-error" : undefined
                }
                aria-invalid={Boolean(errors.smallBlind)}
                className="h-12"
                id="smallBlind"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                type="number"
                {...form.register("smallBlind")}
              />
              <FieldError
                id="smallBlind-error"
                message={errors.smallBlind?.message}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-sm" htmlFor="bigBlind">
                Big Blind
              </Label>
              <Input
                aria-describedby={
                  errors.bigBlind ? "bigBlind-error" : undefined
                }
                aria-invalid={Boolean(errors.bigBlind)}
                className="h-12"
                id="bigBlind"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                type="number"
                {...form.register("bigBlind")}
              />
              <FieldError
                id="bigBlind-error"
                message={errors.bigBlind?.message}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-sm" htmlFor="minBuyIn">
                Min Buy-in
              </Label>
              <Input
                aria-describedby={
                  errors.minBuyIn ? "minBuyIn-error" : undefined
                }
                aria-invalid={Boolean(errors.minBuyIn)}
                className="h-12"
                id="minBuyIn"
                inputMode="decimal"
                min="0"
                step="0.01"
                type="number"
                {...form.register("minBuyIn")}
              />
              <FieldError
                id="minBuyIn-error"
                message={errors.minBuyIn?.message}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-sm" htmlFor="maxBuyIn">
                Max Buy-in
              </Label>
              <Input
                aria-describedby={
                  errors.maxBuyIn ? "maxBuyIn-error" : undefined
                }
                aria-invalid={Boolean(errors.maxBuyIn)}
                className="h-12"
                id="maxBuyIn"
                inputMode="decimal"
                min="0"
                step="0.01"
                type="number"
                {...form.register("maxBuyIn")}
              />
              <FieldError
                id="maxBuyIn-error"
                message={errors.maxBuyIn?.message}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="font-medium text-sm" htmlFor="seatCount">
                Seats
              </Label>
              <Input
                aria-describedby={
                  errors.seatCount ? "seatCount-error" : undefined
                }
                aria-invalid={Boolean(errors.seatCount)}
                className="h-12"
                id="seatCount"
                inputMode="numeric"
                max="9"
                min="2"
                step="1"
                type="number"
                {...form.register("seatCount")}
              />
              <FieldError
                id="seatCount-error"
                message={errors.seatCount?.message}
              />
            </div>
          </div>

          {submitError ? (
            <p
              aria-live="assertive"
              className="text-destructive text-sm"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <Button
            className="h-12 w-full font-semibold text-base"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            {isSubmitting ? (
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
