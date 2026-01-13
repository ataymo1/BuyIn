import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlayerForm } from "@/components/player/player-form"
import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function PlayersPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const players = await db.player.findMany({
    orderBy: {
      name: "asc",
    },
  })

  async function createPlayer(data: { name: string; email?: string }) {
    "use server"
    await db.player.create({
      data: {
        name: data.name,
        email: data.email || null,
      },
    })

    redirect("/players")
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Players</h1>
          <p className="text-muted-foreground">Manage your poker players</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add New Player</CardTitle>
            <CardDescription>Add a player to your ledger</CardDescription>
          </CardHeader>
          <CardContent>
            <PlayerForm onSubmit={createPlayer} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Players</CardTitle>
            <CardDescription>Your poker players</CardDescription>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players yet. Add your first player!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">{player.name}</TableCell>
                      <TableCell>{player.email || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
