import { z } from "zod";

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function numericField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (value) =>
        DECIMAL_NUMBER_PATTERN.test(value) && Number.isFinite(Number(value)),
      { message: `${label} must be a finite number` }
    )
    .transform(Number)
    .pipe(z.number().max(Number.MAX_SAFE_INTEGER, `${label} is too large`));
}

export const livePokerTableFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Table name is required")
      .max(80, "Table name must be 80 characters or less"),
    smallBlind: numericField("Small blind").pipe(
      z.number().positive("Small blind must be greater than zero")
    ),
    bigBlind: numericField("Big blind").pipe(
      z.number().positive("Big blind must be greater than zero")
    ),
    minBuyIn: numericField("Min buy-in").pipe(
      z.number().nonnegative("Min buy-in cannot be negative")
    ),
    maxBuyIn: numericField("Max buy-in").pipe(
      z.number().nonnegative("Max buy-in cannot be negative")
    ),
    seatCount: numericField("Seat count").pipe(
      z
        .number()
        .int("Seat count must be a whole number")
        .min(2, "Seat count must be at least 2")
        .max(9, "Seat count cannot exceed 9")
    ),
  })
  .superRefine((values, context) => {
    if (values.bigBlind < values.smallBlind) {
      context.addIssue({
        code: "custom",
        message: "Big blind must be at least the small blind",
        path: ["bigBlind"],
      });
    }
    if (values.maxBuyIn < values.minBuyIn) {
      context.addIssue({
        code: "custom",
        message: "Max buy-in must be at least the min buy-in",
        path: ["maxBuyIn"],
      });
    }
  });

export type LivePokerTableFormInput = z.input<typeof livePokerTableFormSchema>;
export type LivePokerTableFormValues = z.output<
  typeof livePokerTableFormSchema
>;
