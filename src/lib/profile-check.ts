import { redirect } from "next/navigation"
import { auth } from "./auth"
import { db } from "./db"

/**
 * Checks if the user's profile is complete and redirects to setup if not.
 * Use this in server components/pages that need profile completion.
 */
export async function requireProfileComplete() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { description: true },
  })

  if (!user?.description) {
    redirect("/profile/setup")
  }

  return session
}
