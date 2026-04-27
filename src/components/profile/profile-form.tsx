"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(250, "Description must be less than 50 words")
    .refine(
      (val) => val.trim().split(/\s+/).length <= 50,
      "Description must be 50 words or less"
    ),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileFormProps {
  onSubmit: (data: ProfileFormValues) => void | Promise<void>;
  defaultValues?: Partial<ProfileFormValues>;
  isLoading?: boolean;
}

export function ProfileForm({
  onSubmit,
  defaultValues,
  isLoading,
}: ProfileFormProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaultValues || {
      name: "",
      description: "",
    },
  });

  const handleSubmit = async (data: ProfileFormValues) => {
    // Ensure only plain serializable data is passed
    await onSubmit({
      name: String(data.name),
      description: String(data.description),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Profile</CardTitle>
        <CardDescription>
          Add a brief description to complete your profile setup
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-muted-foreground">(max 50 words)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Tell us a bit about yourself..."
              rows={4}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-destructive text-sm">
                {form.formState.errors.description.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {form.watch("description")?.trim().split(/\s+/).filter(Boolean)
                .length || 0}{" "}
              / 50 words
            </p>
          </div>
          <Button
            disabled={form.formState.isSubmitting || isLoading}
            type="submit"
          >
            {form.formState.isSubmitting || isLoading
              ? "Saving..."
              : "Complete Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
