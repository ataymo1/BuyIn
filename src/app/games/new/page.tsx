import { redirect } from "next/navigation"
import { requireProfileComplete } from "@/lib/profile-check"
import { GameForm } from "@/components/game/game-form"
import { db } from "@/lib/db"

async function createGame(data: { date: string; location?: string; notes?: string }) {
  "use server"
  
  await requireProfileComplete()

  await db.game.create({
    data: {
      date: new Date(data.date),
      location: data.location || null,
      notes: data.notes || null,
    },
  })

  redirect("/games")
}

export default async function NewGamePage() {
  await requireProfileComplete()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">New Game</h1>
        <p className="text-muted-foreground">Create a new poker game session</p>
      </div>
      <GameForm onSubmit={createGame} />
    </div>
  )
}
