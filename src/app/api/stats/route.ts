import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [totalGames, totalPlayers, totalBuyIns, totalCashOuts] =
      await Promise.all([
        db.game.count(),
        db.player.count(),
        db.transaction.aggregate({
          where: { type: "buyin" },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { type: "cashout" },
          _sum: { amount: true },
        }),
      ])

    const totalBuyInAmount = totalBuyIns._sum.amount || 0
    const totalCashOutAmount = totalCashOuts._sum.amount || 0
    const netProfit = totalCashOutAmount - totalBuyInAmount

    return NextResponse.json({
      totalGames,
      totalPlayers,
      totalBuyIns: totalBuyInAmount,
      totalCashOuts: totalCashOutAmount,
      netProfit,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
