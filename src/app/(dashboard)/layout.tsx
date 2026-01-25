import { redirect } from "next/navigation";
import Navbar from "@/components/layout/navbar";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 pt-6 pb-32 md:py-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
