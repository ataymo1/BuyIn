import { BarChart3, Calendar, Home, LogOut, User, UserCog } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth";

export default function Navbar() {
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden border-b md:block">
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
              <Link href="/profile">
                <Button size="sm" variant="ghost">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <form action={handleSignOut}>
              <Button size="sm" type="submit" variant="ghost">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <nav className="border-b md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="w-10" /> {/* Spacer to balance the toggle */}
          <Link className="font-bold text-xl" href="/">
            BuyIn
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background pb-safe md:hidden">
        <div className="grid h-16 grid-cols-5">
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Link>
          <Link
            href="/groups"
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <UserCog className="h-5 w-5" />
            <span className="text-xs">Groups</span>
          </Link>
          <Link
            href="/sessions"
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Sessions</span>
          </Link>
          <Link
            href="/stats"
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs">Stats</span>
          </Link>
          <Link
            href="/profile"
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
