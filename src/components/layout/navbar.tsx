import { BarChart3, Calendar, LogOut, UserCog } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export default function Navbar() {
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-8">
          <Link className="font-bold text-xl" href="/">
            BuyIn
          </Link>
          <div className="flex space-x-4">
            <Link href="/groups">
              <Button size="sm" variant="ghost">
                <UserCog className="mr-2 h-4 w-4" />
                Groups
              </Button>
            </Link>
            <Link href="/sessions">
              <Button size="sm" variant="ghost">
                <Calendar className="mr-2 h-4 w-4" />
                Sessions
              </Button>
            </Link>
            <Link href="/stats">
              <Button size="sm" variant="ghost">
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </Button>
            </Link>
          </div>
        </div>
        <form action={handleSignOut}>
          <Button size="sm" type="submit" variant="ghost">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </nav>
  );
}
