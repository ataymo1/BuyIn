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
  // Players can only be created when users sign up, not manually
  return NextResponse.json(
    { error: "Players can only be created when users sign up for an account" },
    { status: 405 }
  )
}
