import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { LivePokerLobbyClient } from "@/features/live-poker/live-poker-lobby-client";
import { auth } from "@/lib/auth";

export default async function LivePokerLobbyPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-6 pb-32 md:py-8 md:pb-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl">Live Poker</h1>
            <p className="text-muted-foreground text-sm">
              Public tables for signed-in players.
            </p>
          </div>
          <Link href="/live-poker/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Table
            </Button>
          </Link>
        </div>
        <LivePokerLobbyClient />
      </main>
    </div>
  );
}
