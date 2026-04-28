import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { SessionsClient } from "@/features/sessions";
import { auth } from "@/lib/auth";

export default async function SessionsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-6 pb-32 md:py-8 md:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-bold text-2xl">Sessions</h1>
          <Link href="/games/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <SessionsClient />
        </Suspense>
      </main>
    </div>
  );
}
