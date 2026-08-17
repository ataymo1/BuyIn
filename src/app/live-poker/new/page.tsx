import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/layout/navbar";
import { NewLivePokerTableClient } from "@/features/live-poker/new-live-poker-table-client";
import { auth } from "@/lib/auth";

export default async function NewLivePokerTablePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-8 pb-32 md:pb-8">
        <div className="mb-6">
          <h1 className="font-bold text-2xl">Create Live Poker Table</h1>
          <p className="text-muted-foreground text-sm">
            Anyone signed in can join this table.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <NewLivePokerTableClient />
        </Suspense>
      </main>
    </div>
  );
}
