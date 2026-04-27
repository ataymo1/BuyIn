"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { useConvexUser, useUpdateUser, usePlayer } from "@/lib/convex-hooks";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { profileFormSchema, type ProfileFormValues } from "./profile-form-schema";
import { ProfileSkeleton } from "./profile-skeleton";
import {
  PaymentMethodsSection,
  PrivacySettingsSection,
  ProfileActionButtons,
  ProfileNameSection,
  ProfileSaveBanner,
  SignOutSection,
} from "./profile-sections";

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

      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <ProfileNameSection
          form={form}
          isEditing={isEditing}
          playerName={player?.name}
        />

        <PaymentMethodsSection
          form={form}
          isEditing={isEditing}
          venmo={user?.venmo}
          zelle={user?.zelle}
        />

        {isEditing ? (
          <ProfileActionButtons
            isSubmitting={form.formState.isSubmitting}
            onCancel={handleCancel}
          />
        ) : null}

        {saveSuccess && !isEditing ? <ProfileSaveBanner /> : null}
      </form>

      {!isEditing ? (
        <PrivacySettingsSection
          isPrivate={Boolean(user?.profilePrivate)}
          onToggle={handlePrivacyToggle}
        />
      ) : null}

      {!isEditing ? (
        <SignOutSection onSignOut={() => signOut({ callbackUrl: "/login" })} />
      ) : null}
    </div>
  );
}
