import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GameDetailClient } from "@/components/game-detail-client";
import Navbar from "@/components/layout/navbar";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GameDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-6 pb-32 md:py-8 md:pb-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <GameDetailClient gameId={id} />
        </Suspense>
      </main>
    </div>
  );
}
