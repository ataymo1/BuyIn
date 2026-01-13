"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const transactionFormSchema = z.object({
  playerId: z.string().min(1, "Player is required"),
  type: z.enum(["buyin", "cashout"]),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  description: z.string().optional(),
})

type TransactionFormValues = z.infer<typeof transactionFormSchema>

interface TransactionFormProps {
  onSubmit: (data: TransactionFormValues) => void | Promise<void>
  players: Array<{ id: string; name: string }>
  defaultValues?: Partial<TransactionFormValues>
}

export function TransactionForm({
  onSubmit,
  players,
  defaultValues,
}: TransactionFormProps) {
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaultValues || {
      playerId: "",
      type: "buyin",
      amount: "",
      description: "",
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Transaction</CardTitle>
        <CardDescription>Record a buy-in or cash-out</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="playerId">Player</Label>
            <Select
              value={form.watch("playerId")}
              onValueChange={(value) => form.setValue("playerId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.playerId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.playerId.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(value: "buyin" | "cashout") =>
                form.setValue("type", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buyin">Buy-In</SelectItem>
                <SelectItem value="cashout">Cash-Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...form.register("amount")}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-destructive">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Additional notes"
              {...form.register("description")}
            />
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Adding..." : "Add Transaction"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
