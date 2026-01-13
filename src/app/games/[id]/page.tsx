import { notFound, redirect } from "next/navigation"
import { requireProfileComplete } from "@/lib/profile-check"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { TransactionForm } from "@/components/transaction/transaction-form"
import { format } from "date-fns"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function GameDetailPage({
  params,
}: {
  params: { id: string }
}) {
  await requireProfileComplete()

  const game = await db.game.findUnique({
    where: { id: params.id },
    include: {
      gamePlayers: {
        include: {
          player: true,
        },
      },
      transactions: {
        include: {
          player: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  if (!game) {
    notFound()
  }

  const players = await db.player.findMany({
    orderBy: {
      name: "asc",
    },
  })

  async function createTransaction(data: {
    gameId: string
    playerId: string
    type: "buyin" | "cashout"
    amount: string
    description?: string
  }) {
    "use server"
    await db.transaction.create({
      data: {
        gameId: data.gameId,
        playerId: data.playerId,
        type: data.type,
        amount: parseFloat(data.amount),
        description: data.description || null,
      },
    })

    redirect(`/games/${data.gameId}`)
  }

  async function handleCreateTransaction(formData: {
    playerId: string
    type: "buyin" | "cashout"
    amount: string
    description?: string
  }) {
    "use server"
    await createTransaction({
      gameId: game.id,
      playerId: formData.playerId,
      type: formData.type,
      amount: formData.amount,
      description: formData.description,
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/games">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Game Details</h1>
            <p className="text-muted-foreground">
              {format(new Date(game.date), "MMMM dd, yyyy")}
              {game.location && ` • ${game.location}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Game Players</CardTitle>
            <CardDescription>Players in this game</CardDescription>
          </CardHeader>
          <CardContent>
            {game.gamePlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players added yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Buy-In</TableHead>
                    <TableHead>Cash-Out</TableHead>
                    <TableHead>Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {game.gamePlayers.map((gp) => (
                    <TableRow key={gp.id}>
                      <TableCell>{gp.player.name}</TableCell>
                      <TableCell>${Number(gp.buyIn).toFixed(2)}</TableCell>
                      <TableCell>
                        {gp.cashOut ? `$${Number(gp.cashOut).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        {gp.profit
                          ? `$${Number(gp.profit).toFixed(2)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Buy-ins and cash-outs</CardDescription>
          </CardHeader>
          <CardContent>
            {game.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {game.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div>
                      <p className="font-medium">{transaction.player.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.type === "buyin" ? "Buy-In" : "Cash-Out"}
                        {transaction.description && ` • ${transaction.description}`}
                      </p>
                    </div>
                    <p className="font-bold">
                      ${Number(transaction.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Transaction</CardTitle>
          <CardDescription>Record a buy-in or cash-out for this game</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            players={players.map(p => ({ id: p.id, name: p.name }))}
            onSubmit={handleCreateTransaction}
            defaultValues={{ playerId: "", type: "buyin", amount: "", description: "" }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
