"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
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
import { useConvexUser, useUpdateUser } from "@/lib/convex-hooks";

const paymentInfoSchema = z
  .object({
    venmo: z.string().optional(),
    zelle: z.string().optional(),
  })
  .refine((data) => data.venmo?.trim() || data.zelle?.trim(), {
    message: "Please provide at least one payment method (Venmo or Zelle)",
    path: ["venmo"],
  });

type PaymentInfoFormValues = z.infer<typeof paymentInfoSchema>;

export function ProfileClient() {
  const { user, userId, isLoading: userLoading } = useConvexUser();
  const updateUser = useUpdateUser();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<PaymentInfoFormValues>({
    resolver: zodResolver(paymentInfoSchema),
    defaultValues: {
      venmo: "",
      zelle: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        venmo: user.venmo ?? "",
        zelle: user.zelle ?? "",
      });
    }
  }, [user, form]);

  const handleSubmit = async (data: PaymentInfoFormValues) => {
    if (!userId) return;

    try {
      await updateUser({
        id: userId,
        venmo: data.venmo?.trim() || undefined,
        zelle: data.zelle?.trim() || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update payment info:", error);
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="font-bold text-3xl">Payment Info</h1>
          <p className="text-muted-foreground">
            Manage your payment methods for settling up
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>
            Add your Venmo and/or Zelle details so group members can easily
            settle up with you. At least one payment method is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
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
                  The email or phone number linked to your Zelle account
                </p>
              </div>
            </div>

            {form.formState.errors.venmo && (
              <p className="text-destructive text-sm">
                {form.formState.errors.venmo.message}
              </p>
            )}

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              {saveSuccess && (
                <p className="text-green-600 text-sm">
                  Payment info saved successfully!
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Current Payment Info Summary */}
      {(user?.venmo || user?.zelle) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Payment Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {user?.venmo && (
                <div className="rounded-lg border p-4">
                  <p className="mb-1 font-medium text-sm">Venmo</p>
                  <p className="text-muted-foreground">{user.venmo}</p>
                </div>
              )}
              {user?.zelle && (
                <div className="rounded-lg border p-4">
                  <p className="mb-1 font-medium text-sm">Zelle</p>
                  <p className="text-muted-foreground">{user.zelle}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
