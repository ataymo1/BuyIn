import { z } from "zod";

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const MAX_CHIP_AMOUNT = Number.MAX_SAFE_INTEGER / 100;

function isExactChipAmount(value: number) {
  const units = Math.round(value * 100);
  return Number.isSafeInteger(units) && Math.abs(value * 100 - units) <= 1e-7;
}

function chipAmountField(label: string) {
  return numericField(label).pipe(
    z
      .number()
      .max(MAX_CHIP_AMOUNT, `${label} is too large`)
      .refine(isExactChipAmount, `${label} must use increments of 0.01`)
  );
}

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
    smallBlind: chipAmountField("Small blind").pipe(
      z.number().positive("Small blind must be greater than zero")
    ),
    bigBlind: chipAmountField("Big blind").pipe(
      z.number().positive("Big blind must be greater than zero")
    ),
    minBuyIn: chipAmountField("Min buy-in").pipe(
      z.number().nonnegative("Min buy-in cannot be negative")
    ),
    maxBuyIn: chipAmountField("Max buy-in").pipe(
      z.number().positive("Max buy-in must be greater than zero")
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
