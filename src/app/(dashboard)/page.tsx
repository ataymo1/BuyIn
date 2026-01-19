import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardClient />;
}
