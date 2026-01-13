import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Calendar, MapPin } from "lucide-react"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { format } from "date-fns"

export default async function GamesPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const games = await db.game.findMany({
    include: {
      gamePlayers: {
        include: {
          player: true,
        },
      },
    },
    orderBy: {
      date: "desc",
    },
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Games</h1>
          <p className="text-muted-foreground">Manage your poker game sessions</p>
        </div>
        <Link href="/games/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Game
          </Button>
        </Link>
      </div>

      {games.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No games yet.</p>
            <Link href="/games/new">
              <Button>Create Your First Game</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Games</CardTitle>
            <CardDescription>Your poker game sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                        {format(new Date(game.date), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {game.location ? (
                        <div className="flex items-center">
                          <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                          {game.location}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{game.gamePlayers.length}</TableCell>
                    <TableCell>
                      <Link href={`/games/${game.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
