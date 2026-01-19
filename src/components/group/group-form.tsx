"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Group</CardTitle>
        <CardDescription>
          Create a group to organize your poker sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            console.error("Form validation errors:", errors);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              placeholder="e.g., Friday Night Poker"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Tell us about this group..."
              rows={4}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-destructive text-sm">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
          <Button
            disabled={form.formState.isSubmitting || isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting || isSubmitting
              ? "Creating..."
              : "Create Group"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
