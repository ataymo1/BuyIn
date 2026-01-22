"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface PaymentInfoModalProps {
  open: boolean;
  onSuccess: () => void;
}

export function PaymentInfoModal({ open, onSuccess }: PaymentInfoModalProps) {
  const { user, userId } = useConvexUser();
  const updateUser = useUpdateUser();

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
      onSuccess();
    } catch (error) {
      console.error("Failed to update payment info:", error);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="[&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Payment Information</DialogTitle>
          <DialogDescription>
            Add your payment details so group members can settle up with you.
            At least one payment method is required to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="venmo">Venmo Username</Label>
            <Input
              id="venmo"
              placeholder="@your-venmo-username"
              {...form.register("venmo")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zelle">Zelle Email or Phone</Label>
            <Input
              id="zelle"
              placeholder="your-email@example.com or phone number"
              {...form.register("zelle")}
            />
          </div>

          {form.formState.errors.venmo && (
            <p className="text-destructive text-sm">
              {form.formState.errors.venmo.message}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Continue"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
