"use client";

import { ArrowLeft, Banknote, HandCoins, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SessionActionsCardProps {
  onSubmitTransaction: (
    type: "buyin" | "cashout",
    amount: number
  ) => Promise<void>;
}

function AmountInput({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative flex-1">
      <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        autoFocus
        className="pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        disabled={disabled}
        id={id}
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) =>
          ["e", "E", "+", "-"].includes(event.key) && event.preventDefault()
        }
        pattern="[0-9]*[.]?[0-9]*"
        placeholder="0.00"
        step="0.01"
        type="number"
        value={value}
      />
    </div>
  );
}

export function SessionActionsCard({
  onSubmitTransaction,
}: SessionActionsCardProps) {
  const [activeAction, setActiveAction] = useState<"buyin" | "cashout" | null>(
    null
  );
  const [buyInAmount, setBuyInAmount] = useState("");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);

  async function submitTransaction(type: "buyin" | "cashout", amount: number) {
    if (amount <= 0) {
      return;
    }

    setIsSubmittingTransaction(true);
    try {
      await onSubmitTransaction(type, amount);
      if (type === "buyin") {
        setBuyInAmount("");
      } else {
        setCashOutAmount("");
      }
      setActiveAction(null);
    } finally {
      setIsSubmittingTransaction(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>What would you like to do?</CardDescription>
      </CardHeader>
      <CardContent>
        {activeAction === null ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              className="h-24 flex-col gap-2"
              onClick={() => setActiveAction("buyin")}
              variant="outline"
            >
              <Banknote className="h-8 w-8 text-green-600" />
              <span>Buy-in</span>
            </Button>
            <Button
              className="h-24 flex-col gap-2"
              onClick={() => setActiveAction("cashout")}
              variant="outline"
            >
              <HandCoins className="h-8 w-8 text-blue-600" />
              <span>Cash Out</span>
            </Button>
          </div>
        ) : null}

        {activeAction === "buyin" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setActiveAction(null);
                  setBuyInAmount("");
                }}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">Buy-in Amount</span>
            </div>
            <div className="flex gap-2">
              <AmountInput
                disabled={isSubmittingTransaction}
                id="buyin-amount"
                onChange={setBuyInAmount}
                value={buyInAmount}
              />
              <Button
                disabled={
                  isSubmittingTransaction ||
                  !buyInAmount ||
                  Number(buyInAmount) <= 0
                }
                onClick={() => submitTransaction("buyin", Number(buyInAmount))}
              >
                {isSubmittingTransaction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add Buy-in"
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {activeAction === "cashout" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setActiveAction(null);
                  setCashOutAmount("");
                }}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">Cash Out Amount</span>
            </div>
            <div className="flex gap-2">
              <AmountInput
                disabled={isSubmittingTransaction}
                id="cashout-amount"
                onChange={setCashOutAmount}
                value={cashOutAmount}
              />
              <Button
                disabled={
                  isSubmittingTransaction ||
                  !cashOutAmount ||
                  Number(cashOutAmount) <= 0
                }
                onClick={() =>
                  submitTransaction("cashout", Number(cashOutAmount))
                }
              >
                {isSubmittingTransaction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Cash Out"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
