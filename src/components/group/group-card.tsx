"use client";

import { Calendar, Crown, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GroupCardProps {
  id: string;
  name: string;
  description?: string | null;
  role: "OWNER" | "MEMBER";
  memberCount: number;
  activeSessionCount: number;
}

export function GroupCard({
  id,
  name,
  description,
  role,
  memberCount,
  activeSessionCount,
}: GroupCardProps) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{name}</CardTitle>
              {role === "OWNER" && (
                <Crown className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            {description && (
              <CardDescription className="mt-2">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="mb-4 flex items-center gap-4 text-muted-foreground text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>
              {activeSessionCount} active{" "}
              {activeSessionCount === 1 ? "session" : "sessions"}
            </span>
          </div>
        </div>
        <div className="mt-auto">
          <Link href={`/groups/${id}`}>
            <Button className="w-full" variant="outline">
              View Group
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
