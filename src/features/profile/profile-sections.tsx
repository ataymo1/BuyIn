"use client";

import {
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  User,
  X,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
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
import type { ProfileFormValues } from "./profile-form-schema";

interface ProfileNameSectionProps {
  form: UseFormReturn<ProfileFormValues>;
  isEditing: boolean;
  playerName?: string | null;
}

export function ProfileNameSection({
  form,
  isEditing,
  playerName,
}: ProfileNameSectionProps) {
  return (
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
              className="max-w-md"
              id="name"
              placeholder="Your name"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="py-1">
            <p className="font-medium text-base">
              {playerName || (
                <span className="text-muted-foreground italic">Not set</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PaymentMethodsSectionProps {
  form: UseFormReturn<ProfileFormValues>;
  isEditing: boolean;
  venmo?: string | null;
  zelle?: string | null;
}

function PaymentMethodDisplay({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-4">
        <p className="text-muted-foreground text-sm">No {label} set</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="mb-1.5 font-semibold text-muted-foreground text-sm">
        {label}
      </p>
      <p className="break-all font-medium text-base">{value}</p>
    </div>
  );
}

export function PaymentMethodsSection({
  form,
  isEditing,
  venmo,
  zelle,
}: PaymentMethodsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          Payment Methods
        </CardTitle>
        <CardDescription>
          Add your Venmo and/or Zelle details so group members can easily settle
          up with you. At least one payment method is required.
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

            {form.formState.errors.venmo ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.venmo.message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
            <PaymentMethodDisplay label="Venmo" value={venmo} />
            <PaymentMethodDisplay label="Zelle" value={zelle} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProfileActionButtonsProps {
  isSubmitting: boolean;
  onCancel: () => void;
}

export function ProfileActionButtons({
  isSubmitting,
  onCancel,
}: ProfileActionButtonsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
      <Button
        className="w-full sm:w-auto"
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        <X className="mr-2 h-4 w-4" />
        Cancel
      </Button>
      <Button
        className="w-full sm:w-auto"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
    </div>
  );
}

export function ProfileSaveBanner() {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
      <p className="font-medium text-green-800 text-sm">
        Profile updated successfully!
      </p>
    </div>
  );
}

interface PrivacySettingsSectionProps {
  isPrivate: boolean;
  onToggle: () => void;
}

export function PrivacySettingsSection({
  isPrivate,
  onToggle,
}: PrivacySettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          {isPrivate ? (
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
            <p className="text-muted-foreground text-sm">
              {isPrivate
                ? "Your stats and payment info are hidden from other players"
                : "Other players in your groups can see your stats and payment info"}
            </p>
          </div>
          <Button className="shrink-0" onClick={onToggle} variant="outline">
            {isPrivate ? "Make Public" : "Make Private"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SignOutSectionProps {
  onSignOut: () => void;
}

export function SignOutSection({ onSignOut }: SignOutSectionProps) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="pt-6">
        <Button
          className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={onSignOut}
          variant="outline"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </CardContent>
    </Card>
  );
}
