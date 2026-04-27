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
    <Card className="overflow-hidden border-0 shadow-xl shadow-black/5">
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
            <Label htmlFor="name" className="text-sm font-medium">
              Group Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Friday Night Poker"
              className="h-12 text-base transition-all focus:ring-2 focus:ring-emerald-500/20"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Tell us about this group... (stakes, frequency, house rules, etc.)"
              rows={4}
              className="resize-none text-base transition-all focus:ring-2 focus:ring-emerald-500/20"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-destructive text-sm flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-destructive text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              disabled={isLoading}
              type="submit"
              size="lg"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
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
            <p className="text-center text-xs text-muted-foreground">
              You'll be the owner and can invite members after creating
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
