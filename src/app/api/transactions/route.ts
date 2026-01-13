import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const transactions = await db.transaction.findMany({
      include: {
        player: true,
        game: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
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
    const { gameId, playerId, type, amount, description } = body

    const transaction = await db.transaction.create({
      data: {
        gameId,
        playerId,
        type,
        amount: parseFloat(amount),
        description: description || null,
      },
    })

    // Update GamePlayer if it exists, or create it
    const gamePlayer = await db.gamePlayer.findUnique({
      where: {
        gameId_playerId: {
          gameId,
          playerId,
        },
      },
    })

    if (gamePlayer) {
      if (type === "buyin") {
        await db.gamePlayer.update({
          where: {
            gameId_playerId: {
              gameId,
              playerId,
            },
          },
          data: {
            buyIn: {
              increment: parseFloat(amount),
            },
          },
        })
      } else if (type === "cashout") {
        await db.gamePlayer.update({
          where: {
            gameId_playerId: {
              gameId,
              playerId,
            },
          },
          data: {
            cashOut: parseFloat(amount),
            profit: {
              // Calculate profit: cashOut - buyIn
            },
          },
        })
      }
    } else {
      // Create new GamePlayer entry
      const newGamePlayer = await db.gamePlayer.create({
        data: {
          gameId,
          playerId,
          buyIn: type === "buyin" ? parseFloat(amount) : 0,
          cashOut: type === "cashout" ? parseFloat(amount) : null,
          profit:
            type === "cashout"
              ? parseFloat(amount) - 0
              : null,
        },
      })
    }

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error("Error creating transaction:", error)
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    )
  }
}
