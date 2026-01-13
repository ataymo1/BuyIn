import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/stats/stats-card"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Calendar, Users, TrendingUp, DollarSign } from "lucide-react"

export default async function StatsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">Overview of your poker ledger</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Games"
          value={totalGames}
          description="Games tracked"
          icon={<Calendar className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Players"
          value={totalPlayers}
          description="Active players"
          icon={<Users className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Buy-Ins"
          value={`$${Number(totalBuyInAmount).toFixed(2)}`}
          description="All time"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatsCard
          title="Net Profit"
          value={`$${Number(netProfit).toFixed(2)}`}
          description="Total cash-outs minus buy-ins"
          icon={<TrendingUp className="h-4 w-4" />}
          trend={{
            value: netProfit >= 0 ? "Positive" : "Negative",
            isPositive: netProfit >= 0,
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buy-In Summary</CardTitle>
            <CardDescription>Total buy-ins across all games</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${Number(totalBuyInAmount).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total amount invested in games
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash-Out Summary</CardTitle>
            <CardDescription>Total cash-outs across all games</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${Number(totalCashOutAmount).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total amount cashed out
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
