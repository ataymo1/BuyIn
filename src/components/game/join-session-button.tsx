"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
        alert(error.error || "Failed to join session");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error joining session:", error);
      alert("Failed to join session");
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
