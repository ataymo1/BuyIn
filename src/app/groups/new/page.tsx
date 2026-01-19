import { redirect } from "next/navigation";
import { NewGroupClient } from "@/components/new-group-client";
import { auth } from "@/lib/auth";

export default async function NewGroupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <NewGroupClient />;
}
