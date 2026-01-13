import { requireProfileComplete } from "@/lib/profile-check"
import Navbar from "@/components/layout/navbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This will redirect if not authenticated or profile incomplete
  await requireProfileComplete()

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
