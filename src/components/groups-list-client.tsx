"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { GroupCard } from "@/components/group/group-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GroupCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useUserGroups } from "@/lib/convex-hooks";

const groupCardSkeletons = [
  "group-card-1",
  "group-card-2",
  "group-card-3",
  "group-card-4",
  "group-card-5",
  "group-card-6",
];

function GroupsListSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-9 w-24" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groupCardSkeletons.map((skeletonKey) => (
          <GroupCardSkeleton key={skeletonKey} />
        ))}
      </div>
    </div>
  );
}

export function GroupsListClient() {
  const { groups, isLoading } = useUserGroups();

  if (isLoading) {
    return <GroupsListSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl">Groups</h1>
          <p className="text-muted-foreground">
            Manage your poker groups and sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="flex-1 sm:flex-none" href="/groups/search">
            <Button className="w-full sm:w-auto" variant="outline">
              <Search className="mr-2 h-4 w-4" />
              Find Groups
            </Button>
          </Link>
          <Link className="flex-1 sm:flex-none" href="/groups/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Group
            </Button>
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">No groups yet.</p>
            <Link href="/groups/new">
              <Button>Create Your First Group</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              activeSessionCount={group?.activeSessionCount ?? 0}
              description={group?.description}
              id={group?._id ?? ""}
              key={group?._id}
              memberCount={group?.memberCount ?? 0}
              name={group?.name ?? ""}
              role={group?.role ?? "MEMBER"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
