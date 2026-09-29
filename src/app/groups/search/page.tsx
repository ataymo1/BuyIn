import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GroupSearchClient } from "@/components/group-search-client";
import Navbar from "@/components/layout/navbar";
import { auth } from "@/lib/auth";

export default async function GroupSearchPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-32 sm:px-6 md:pt-12 md:pb-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <GroupSearchClient />
        </Suspense>
      </main>
    </div>
  );
}
