import { redirect } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/layout/navbar";
import { PokerNowImportClient } from "@/components/poker-now-import-client";
import { auth } from "@/lib/auth";

export default async function ImportPokerNowPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Suspense
        fallback={
          <div className="p-10 text-center text-muted-foreground">
            Loading import…
          </div>
        }
      >
        <PokerNowImportClient />
      </Suspense>
    </div>
  );
}
