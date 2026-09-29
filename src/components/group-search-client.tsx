"use client";

import { Check, Clock, Loader2, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConvexUser,
  useDiscoverableGroups,
  useDiscoveryVolumeSummary,
  useRequestToJoin,
  useSearchGroups,
} from "@/lib/convex-hooks";

const groupCardSkeletons = [
  "group-card-1",
  "group-card-2",
  "group-card-3",
  "group-card-4",
  "group-card-5",
  "group-card-6",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const sessionDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function DiscoveryVolumeSummary() {
  const summary = useDiscoveryVolumeSummary();

  return (
    <section
      aria-busy={summary === undefined}
      aria-label="Community buy-in totals"
      className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-medium text-muted-foreground text-sm">
            Total buy-ins · All time
          </h2>
          {summary === undefined ? (
            <Skeleton
              aria-label="Loading total buy-ins"
              className="mt-3 h-12 w-64 max-w-full"
            />
          ) : (
            <p className="mt-2 break-words font-semibold text-3xl tabular-nums tracking-tight sm:text-4xl">
              {currency.format(summary.totalBuyIns)}
            </p>
          )}
          <p className="mt-2 text-muted-foreground text-sm">
            Across the BuyIn community, every season.
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-8 sm:gap-10">
          <div>
            <dt className="text-muted-foreground text-sm">Groups</dt>
            <dd className="mt-1 font-semibold text-2xl tabular-nums">
              {summary === undefined ? (
                <Skeleton
                  aria-label="Loading group count"
                  className="h-8 w-12"
                />
              ) : (
                summary.groupCount.toLocaleString("en-US")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">
              Completed sessions
            </dt>
            <dd className="mt-1 font-semibold text-2xl tabular-nums">
              {summary === undefined ? (
                <Skeleton
                  aria-label="Loading session count"
                  className="h-8 w-12"
                />
              ) : (
                summary.completedSessionCount.toLocaleString("en-US")
              )}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mt-6 border-violet-500/10 border-t pt-4 text-muted-foreground text-xs">
        Approved buy-ins from completed sessions. Cash-outs are excluded.
      </p>
    </section>
  );
}

function VolumeCardSkeleton() {
  return (
    <Card aria-label="Loading group" className="p-6">
      <Skeleton className="h-5 w-36 max-w-full" />
      <Skeleton className="mt-6 h-4 w-32 max-w-full" />
      <Skeleton className="mt-2 h-9 w-40 max-w-full" />
      <Skeleton className="mt-3 h-4 w-48 max-w-full" />
      <div className="mt-6 flex justify-between gap-4 border-t pt-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>
    </Card>
  );
}

export function GroupSearchClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [requestingGroupId, setRequestingGroupId] = useState<string | null>(
    null
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingJoinGroupId, setPendingJoinGroupId] = useState<string | null>(
    null
  );

  const { groups: searchResults, isLoading: searchLoading } =
    useSearchGroups(searchTerm);
  const { groups: discoverableGroups, isLoading: discoverableLoading } =
    useDiscoverableGroups();
  const { userId, user } = useConvexUser();
  const requestToJoin = useRequestToJoin();

  // Use search results when searching, otherwise show discoverable groups
  const groups = searchTerm.trim() ? searchResults : discoverableGroups;
  const isLoading = searchTerm.trim() ? searchLoading : discoverableLoading;

  const performJoinRequest = async (groupId: string) => {
    if (!userId) {
      return;
    }

    setRequestingGroupId(groupId);
    try {
      await requestToJoin({
        groupId: groupId as Parameters<typeof requestToJoin>[0]["groupId"],
        userId,
      });
    } catch (error) {
      console.error("Failed to request to join:", error);
    } finally {
      setRequestingGroupId(null);
      setPendingJoinGroupId(null);
    }
  };

  const handleRequestToJoin = async (groupId: string) => {
    if (!userId) {
      return;
    }

    // Check if user has payment info (venmo or zelle)
    const hasPaymentInfo = user?.venmo?.trim() || user?.zelle?.trim();

    if (hasPaymentInfo) {
      // User already has payment info, proceed directly
      await performJoinRequest(groupId);
    } else {
      // User needs to add payment info first
      setPendingJoinGroupId(groupId);
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);

    if (!pendingJoinGroupId) {
      return;
    }

    await performJoinRequest(pendingJoinGroupId);
  };

  const renderCardAction = (group: (typeof groups)[0]) => {
    if (group.isMember) {
      return (
        <Button disabled size="sm" variant="secondary">
          <Check className="mr-1 h-4 w-4" />
          Member
        </Button>
      );
    }

    if (group.hasPendingRequest) {
      return (
        <Button disabled size="sm" variant="outline">
          <Clock className="mr-1 h-4 w-4" />
          Pending
        </Button>
      );
    }

    return (
      <Button
        disabled={requestingGroupId === group._id}
        onClick={() => handleRequestToJoin(group._id)}
        size="sm"
      >
        {requestingGroupId === group._id ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="mr-1 h-4 w-4" />
        )}
        Request to Join
      </Button>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groupCardSkeletons.map((skeletonKey) => (
            <VolumeCardSkeleton key={skeletonKey} />
          ))}
        </div>
      );
    }

    if (groups.length === 0 && !searchTerm.trim()) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No groups available to join yet
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              <Link className="text-primary hover:underline" href="/groups/new">
                Create your own group
              </Link>
            </p>
          </CardContent>
        </Card>
      );
    }

    if (groups.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-2 text-muted-foreground">
              No groups found matching "{searchTerm}"
            </p>
            <p className="text-muted-foreground text-sm">
              Try a different search term or{" "}
              <Link className="text-primary hover:underline" href="/groups/new">
                create your own group
              </Link>
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card className="flex min-w-0 flex-col" key={group._id}>
            <CardHeader className="pb-3">
              <CardTitle className="break-words text-lg">
                {group.name}
              </CardTitle>
              {group.description && (
                <CardDescription className="line-clamp-2">
                  {group.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="mb-6">
                <p className="text-muted-foreground text-xs">
                  Total buy-ins · All time
                </p>
                <p className="mt-1 break-words font-semibold text-3xl tabular-nums tracking-tight">
                  {currency.format(group.totalBuyIns)}
                </p>
                {group.completedSessionCount === 0 ? (
                  <p className="mt-3 text-muted-foreground text-sm">
                    No completed sessions yet
                  </p>
                ) : (
                  <div className="mt-3 space-y-1 text-muted-foreground text-xs">
                    <p>
                      {group.completedSessionCount.toLocaleString("en-US")}{" "}
                      completed{" "}
                      {group.completedSessionCount === 1
                        ? "session"
                        : "sessions"}
                    </p>
                    {group.lastCompletedSessionAt !== null ? (
                      <p>
                        Last session{" "}
                        <time
                          dateTime={new Date(
                            group.lastCompletedSessionAt
                          ).toISOString()}
                        >
                          {sessionDate.format(group.lastCompletedSessionAt)}
                        </time>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex items-center gap-4 text-muted-foreground text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {group.memberCount} members
                  </span>
                </div>
                {renderCardAction(group)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-3xl">Find Groups</h1>
        <p className="text-muted-foreground">Search for poker groups to join</p>
      </div>

      <DiscoveryVolumeSummary />

      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search groups by name"
          className="pl-10"
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search groups by name..."
          type="text"
          value={searchTerm}
        />
      </div>

      {renderContent()}

      <PaymentInfoModal
        onSuccess={handlePaymentSuccess}
        open={showPaymentModal}
      />
    </div>
  );
}
