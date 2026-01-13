import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const games = await db.game.findMany({
      include: {
        gamePlayers: {
          include: {
            player: true,
          },
        },
        transactions: true,
      },
      orderBy: {
        date: "desc",
      },
    })

    return NextResponse.json(games)
  } catch (error) {
    console.error("Error fetching games:", error)
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { date, location, notes } = body

    const game = await db.game.create({
      data: {
        date: new Date(date),
        location: location || null,
        notes: notes || null,
      },
    })

    return NextResponse.json(game, { status: 201 })
  } catch (error) {
    console.error("Error creating game:", error)
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    )
  }
}
