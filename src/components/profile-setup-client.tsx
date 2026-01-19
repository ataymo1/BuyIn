"use client";

import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { useConvexUser, usePlayer } from "@/lib/convex-hooks";
import { api } from "../../convex/_generated/api";

export function ProfileSetupClient() {
  const router = useRouter();
  const { userId, isLoading: userLoading, session } = useConvexUser();
  const { player, isLoading: playerLoading } = usePlayer();
  const createPlayer = useMutation(api.players.createPlayer);
  const updatePlayer = useMutation(api.players.updatePlayer);

  const isLoading = userLoading || playerLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If profile is already complete, redirect to dashboard
  if (player?.name) {
    router.push("/");
    return null;
  }

  async function handleCompleteProfile(data: {
    name: string;
    description: string;
  }) {
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Validate description word count
    const wordCount = data.description
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (wordCount > 50) {
      throw new Error("Description must be 50 words or less");
    }

    if (player) {
      // Update existing player
      await updatePlayer({
        playerId: player._id,
        name: data.name,
      });
    } else {
      // Create new player
      await createPlayer({
        userId,
        name: data.name,
        email: session?.user?.email ?? "",
      });
    }

    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ProfileForm
          defaultValues={{
            name: player?.name ?? session?.user?.name ?? "",
            description: "",
          }}
          onSubmit={handleCompleteProfile}
        />
      </div>
    </div>
  );
}
