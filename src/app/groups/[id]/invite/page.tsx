import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>No invite token provided</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/groups">Go to Groups</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For now, redirect to the group page
  // The invite functionality would need to be implemented via Convex mutations
  redirect(`/groups/${id}`);
}
