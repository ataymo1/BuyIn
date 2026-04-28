import { z } from "zod";

export const profileFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    venmo: z.string().optional(),
    zelle: z.string().optional(),
  })
  .refine((data) => data.venmo?.trim() || data.zelle?.trim(), {
    message: "Please provide at least one payment method (Venmo or Zelle)",
    path: ["venmo"],
  });

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
