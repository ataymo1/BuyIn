import { redirect } from "next/navigation";
import { ProfileSetupClient } from "@/components/profile-setup-client";
import { auth } from "@/lib/auth";

export default async function ProfileSetupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ProfileSetupClient />;
}
