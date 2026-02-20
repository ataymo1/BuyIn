import { redirect } from "next/navigation";
import { PlayerStatsClient } from "@/components/player-stats-client";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayerStatsPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return <PlayerStatsClient userId={id} />;
}
