"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Edit2, Eye, EyeOff, LogOut, Loader2, User, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useConvexUser, useUpdateUser, usePlayer } from "@/lib/convex-hooks";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Name Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-5 w-32" />
        </CardContent>
      </Card>

      {/* Payment Methods Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sign Out Section */}
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

const profileFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    venmo: z.string().optional(),
    zelle: z.string().optional(),
  })
  .refine((data) => data.venmo?.trim() || data.zelle?.trim(), {
    message: "Please provide at least one payment method (Venmo or Zelle)",
    path: ["venmo"],
  });

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfileClient() {
  const { user, userId, isLoading: userLoading } = useConvexUser();
  const { player, isLoading: playerLoading } = usePlayer();
  const updateUser = useUpdateUser();
  const updatePlayer = useMutation(api.players.updatePlayer);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      venmo: "",
      zelle: "",
    },
  });

  useEffect(() => {
    if (user && player) {
      form.reset({
        name: player.name ?? "",
        venmo: user.venmo ?? "",
        zelle: user.zelle ?? "",
      });
    }
  }, [user, player, form]);

  const handleSubmit = async (data: ProfileFormValues) => {
    if (!userId || !player) return;

    try {
      // Update player name
      await updatePlayer({
        playerId: player._id,
        name: data.name.trim() || undefined,
      });
      // Update user payment methods
      await updateUser({
        id: userId,
        venmo: data.venmo?.trim() || undefined,
        zelle: data.zelle?.trim() || undefined,
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user && player) {
      form.reset({
        name: player.name ?? "",
        venmo: user.venmo ?? "",
        zelle: user.zelle ?? "",
      });
    }
  };

  const handlePrivacyToggle = async () => {
    if (!userId) return;
    try {
      await updateUser({
        id: userId,
        profilePrivate: !user?.profilePrivate,
      });
    } catch (error) {
      console.error("Failed to toggle privacy:", error);
    }
  };

  if (userLoading || playerLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl">Profile</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Manage your profile information and payment methods
          </p>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="w-full sm:w-auto sm:shrink-0"
            type="button"
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Name Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <User className="h-5 w-5 text-muted-foreground" />
            Name
          </CardTitle>
          <CardDescription>
            Your display name shown to other users
          </CardDescription>
        </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  {...form.register("name")}
                  className="max-w-md"
                />
                {form.formState.errors.name && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-1">
                <p className="text-base font-medium">
                  {player?.name || (
                    <span className="text-muted-foreground italic">Not set</span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Add your Venmo and/or Zelle details so group members can easily
              settle up with you. At least one payment method is required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-5">
                <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0">
                  <div className="space-y-2">
                    <Label htmlFor="venmo">Venmo Username</Label>
                    <Input
                      id="venmo"
                      placeholder="@your-venmo-username"
                      {...form.register("venmo")}
                    />
                    <p className="text-muted-foreground text-xs">
                      Your Venmo handle (e.g., @john-doe)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zelle">Zelle Email or Phone</Label>
                    <Input
                      id="zelle"
                      placeholder="your-email@example.com"
                      {...form.register("zelle")}
                    />
                    <p className="text-muted-foreground text-xs">
                      The email or phone number linked to your Zelle
                    </p>
                  </div>
                </div>

                {form.formState.errors.venmo && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.venmo.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
                {user?.venmo ? (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-1.5 text-sm font-semibold text-muted-foreground">
                      Venmo
                    </p>
                    <p className="break-all text-base font-medium">
                      {user.venmo}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">No Venmo set</p>
                  </div>
                )}
                {user?.zelle ? (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-1.5 text-sm font-semibold text-muted-foreground">
                      Zelle
                    </p>
                    <p className="break-all text-base font-medium">
                      {user.zelle}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">No Zelle set</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        )}

        {saveSuccess && !isEditing && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-sm font-medium text-green-800">
              Profile updated successfully!
            </p>
          </div>
        )}
      </form>

      {/* Privacy Settings Section */}
      {!isEditing && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              {user?.profilePrivate ? (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Eye className="h-5 w-5 text-muted-foreground" />
              )}
              Privacy Settings
            </CardTitle>
            <CardDescription>
              Control who can see your stats and payment methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">Private Profile</p>
                <p className="text-sm text-muted-foreground">
                  {user?.profilePrivate
                    ? "Your stats and payment info are hidden from other players"
                    : "Other players in your groups can see your stats and payment info"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handlePrivacyToggle}
                className="shrink-0"
              >
                {user?.profilePrivate ? "Make Public" : "Make Private"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sign Out Section */}
      {!isEditing && (
        <Card className="border-destructive/20">
          <CardContent className="pt-6">
            <Button
              variant="outline"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
