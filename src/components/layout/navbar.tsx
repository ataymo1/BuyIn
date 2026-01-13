import Link from "next/link"
import { signOut } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Home, Users, History, BarChart3, LogOut } from "lucide-react"

export default function Navbar() {
  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-8">
          <Link href="/" className="text-xl font-bold">
            BuyIn
          </Link>
          <div className="flex space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/games">
              <Button variant="ghost" size="sm">
                Games
              </Button>
            </Link>
            <Link href="/players">
              <Button variant="ghost" size="sm">
                <Users className="mr-2 h-4 w-4" />
                Players
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="ghost" size="sm">
                <History className="mr-2 h-4 w-4" />
                History
              </Button>
            </Link>
            <Link href="/stats">
              <Button variant="ghost" size="sm">
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </Button>
            </Link>
          </div>
        </div>
        <form action={handleSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </nav>
  )
}
