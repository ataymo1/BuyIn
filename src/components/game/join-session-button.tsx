"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotification } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";

interface JoinSessionButtonProps {
  gameId: string;
  isJoined: boolean;
}

export function JoinSessionButton({
  gameId,
  isJoined,
}: JoinSessionButtonProps) {
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  const { showNotification } = useNotification();

  if (isJoined) {
    return null;
  }

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        showNotification(error.error || "Failed to join session", { type: "error" });
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error joining session:", error);
      showNotification("Failed to join session", { type: "error" });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Button disabled={isJoining} onClick={handleJoin}>
      <LogIn className="mr-2 h-4 w-4" />
      {isJoining ? "Joining..." : "Join Session"}
    </Button>
  );
}
