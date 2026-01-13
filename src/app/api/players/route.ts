import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const players = await db.player.findMany({
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(players)
  } catch (error) {
    console.error("Error fetching players:", error)
    return NextResponse.json(
      { error: "Failed to fetch players" },
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
    const { name, email } = body

    const player = await db.player.create({
      data: {
        name,
        email: email || null,
      },
    })

    return NextResponse.json(player, { status: 201 })
  } catch (error) {
    console.error("Error creating player:", error)
    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 }
    )
  }
}
