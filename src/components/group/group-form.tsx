"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

const groupFormSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name must be less than 100 characters"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

interface GroupFormProps {
  onSubmit: (data: GroupFormValues) => void | Promise<void>;
  defaultValues?: Partial<GroupFormValues>;
  isSubmitting?: boolean;
}

export function GroupForm({
  onSubmit,
  defaultValues,
  isSubmitting,
}: GroupFormProps) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: defaultValues || {
      name: "",
      description: "",
    },
  });

  const handleSubmit = async (data: GroupFormValues) => {
    setError(null);
    try {
      await onSubmit({
        name: String(data.name).trim(),
        description: data.description
          ? String(data.description).trim()
          : undefined,
      });
    } catch (err) {
      // Next.js redirect() throws a special error that we should not catch
      // Check if it's a redirect error by looking for the digest property
      if (
        err instanceof Error &&
        "digest" in err &&
        typeof err.digest === "string" &&
        err.digest.startsWith("NEXT_REDIRECT")
      ) {
        // Re-throw redirect errors so Next.js can handle them properly
        throw err;
      }
      // Only catch and display actual errors (not redirects)
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create group";
      setError(errorMessage);
      console.error("Error creating group:", err);
    }
  };

  const isLoading = form.formState.isSubmitting || isSubmitting;

  return (
    <Card className="overflow-hidden border-0 shadow-black/5 shadow-xl">
      <CardHeader className="border-b bg-muted/30 pb-6">
        <CardTitle className="text-xl">Group Details</CardTitle>
        <CardDescription>
          Give your group a name and description to help members identify it
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            console.error("Form validation errors:", errors);
          })}
        >
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="name">
              Group Name <span className="text-destructive">*</span>
            </Label>
            <Input
              className="h-12 text-base transition-all focus:ring-2 focus:ring-emerald-500/20"
              id="name"
              placeholder="e.g., Friday Night Poker"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="flex items-center gap-1 text-destructive text-sm">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              className="resize-none text-base transition-all focus:ring-2 focus:ring-emerald-500/20"
              id="description"
              placeholder="Tell us about this group... (stakes, frequency, house rules, etc.)"
              rows={4}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="flex items-center gap-1 text-destructive text-sm">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="font-medium text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="h-12 w-full bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-base text-white shadow-emerald-500/25 shadow-lg transition-all hover:from-emerald-600 hover:to-teal-700 hover:text-white hover:shadow-emerald-500/30 hover:shadow-xl"
              disabled={isLoading}
              size="lg"
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating your group...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create Group
                </>
              )}
            </Button>
            <p className="text-center text-muted-foreground text-xs">
              You'll be the owner and can invite members after creating
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
