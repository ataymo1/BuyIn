import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/lib/db"
import { requireProfileComplete } from "@/lib/profile-check"
import { format } from "date-fns"

export default async function HistoryPage() {
  await requireProfileComplete()

  const transactions = await db.transaction.findMany({
    include: {
      player: true,
      game: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">History</h1>
        <p className="text-muted-foreground">Transaction history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest buy-ins and cash-outs</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Game</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.player.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          transaction.type === "buyin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {transaction.type === "buyin" ? "Buy-In" : "Cash-Out"}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold">
                      ${Number(transaction.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(transaction.game.date), "MMM dd, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
