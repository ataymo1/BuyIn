import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/layout/navbar";
import { NewGroupClient } from "@/components/new-group-client";
import { auth } from "@/lib/auth";

export default async function NewGroupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <NewGroupClient />
      </Suspense>
    </div>
  );
}
