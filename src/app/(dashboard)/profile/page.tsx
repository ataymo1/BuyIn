import { redirect } from "next/navigation";
import { ProfileClient } from "@/features/profile";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ProfileClient />;
}
