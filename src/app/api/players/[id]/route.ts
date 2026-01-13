import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const player = await db.player.findUnique({
      where: { id: params.id },
      include: {
        gamePlayers: {
          include: {
            game: true,
          },
        },
        transactions: {
          include: {
            game: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    return NextResponse.json(player)
  } catch (error) {
    console.error("Error fetching player:", error)
    return NextResponse.json(
      { error: "Failed to fetch player" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db.player.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting player:", error)
    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    )
  }
}
