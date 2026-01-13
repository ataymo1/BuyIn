import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProfileForm } from "@/components/profile/profile-form"

export default async function ProfileSetupPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  // Fetch user data to check if profile is complete
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      description: true,
      email: true,
    },
  })

  // If profile is already complete, redirect to dashboard
  if (user?.description) {
    redirect("/")
  }

  async function completeProfile(data: { name: string; description: string }) {
    "use server"
    
    const currentSession = await auth()
    if (!currentSession?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Validate description word count
    const wordCount = data.description.trim().split(/\s+/).filter(Boolean).length
    if (wordCount > 50) {
      throw new Error("Description must be 50 words or less")
    }

    // Update user with description
    const updatedUser = await db.user.update({
      where: { id: currentSession.user.id },
      data: {
        name: data.name,
        description: data.description,
      },
    })

    // Check if Player record exists for this user
    const existingPlayer = await db.player.findUnique({
      where: { userId: currentSession.user.id },
    })

    // If no Player exists, create one linked to the user
    if (!existingPlayer) {
      await db.player.create({
        data: {
          name: updatedUser.name || "Unknown",
          email: updatedUser.email,
          userId: updatedUser.id,
        },
      })
    }

    // Revalidate the cache to ensure fresh data is fetched
    revalidatePath("/", "layout")
    revalidatePath("/profile/setup")
    
    redirect("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ProfileForm
          onSubmit={completeProfile}
          defaultValues={{
            name: user?.name || session.user.name || "",
            description: user?.description || "",
          }}
        />
      </div>
    </div>
  )
}
