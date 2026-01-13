"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const gameFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  location: z.string().optional(),
  notes: z.string().optional(),
})

type GameFormValues = z.infer<typeof gameFormSchema>

interface GameFormProps {
  onSubmit: (data: GameFormValues) => void | Promise<void>
  defaultValues?: Partial<GameFormValues>
}

export function GameForm({ onSubmit, defaultValues }: GameFormProps) {
  const form = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: defaultValues || {
      date: new Date().toISOString().split("T")[0],
      location: "",
      notes: "",
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Game</CardTitle>
        <CardDescription>Add a new poker game session</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              {...form.register("date")}
            />
            {form.formState.errors.date && (
              <p className="text-sm text-destructive">
                {form.formState.errors.date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              placeholder="e.g., Home, Casino, Friend's house"
              {...form.register("location")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any additional notes about this game"
              {...form.register("notes")}
            />
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating..." : "Create Game"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
