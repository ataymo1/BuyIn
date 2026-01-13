import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || !description) {
      return NextResponse.json(
        { error: "Name and description are required" },
        { status: 400 }
      )
    }

    // Validate description word count
    const wordCount = description.trim().split(/\s+/).filter(Boolean).length
    if (wordCount > 50) {
      return NextResponse.json(
        { error: "Description must be 50 words or less" },
        { status: 400 }
      )
    }

    // Update user with description
    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        name,
        description,
      },
    })

    // Check if Player record exists for this user
    const existingPlayer = await db.player.findUnique({
      where: { userId: session.user.id },
    })

    // If no Player exists, create one linked to the user
    if (!existingPlayer) {
      await db.player.create({
        data: {
          name: user.name || "Unknown",
          email: user.email,
          userId: user.id,
        },
      })
    }

    return NextResponse.json({ success: true, user }, { status: 200 })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
