"use client";

import {
  ArrowDown,
  Check,
  Clock,
  Loader2,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
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

const rowColumns = "md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_132px_144px]";

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
      className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 sm:p-7"
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
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-8 sm:gap-10">
          <div className="flex flex-col">
            <dt className="mt-1 text-muted-foreground text-sm">Groups</dt>
            <dd className="order-first font-semibold text-2xl tabular-nums sm:text-3xl">
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
          <div className="flex flex-col">
            <dt className="mt-1 text-muted-foreground text-sm">
              Completed sessions
            </dt>
            <dd className="order-first font-semibold text-2xl tabular-nums sm:text-3xl">
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
      <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
        Across every season · Approved buy-ins from completed sessions
      </p>
    </section>
  );
}

function VolumeCardSkeleton() {
  return (
    <Card
      aria-label="Loading group"
      className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4 p-5 md:gap-6 ${rowColumns}`}
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <Skeleton className="h-5 w-36 max-w-full" />
        <Skeleton className="mt-2 h-3 w-24 max-w-full" />
      </div>
      <Skeleton className="h-7 w-32 max-w-full md:justify-self-end" />
      <div>
        <Skeleton className="h-4 w-20 max-w-full" />
        <Skeleton className="mt-2 h-3 w-24 max-w-full" />
      </div>
      <Skeleton className="col-span-2 h-10 w-full md:col-span-1" />
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
        <Button className="h-10 w-full" disabled size="sm" variant="secondary">
          <Check className="mr-1 h-4 w-4" />
          Member
        </Button>
      );
    }

    if (group.hasPendingRequest) {
      return (
        <Button className="h-10 w-full" disabled size="sm" variant="outline">
          <Clock className="mr-1 h-4 w-4" />
          Pending
        </Button>
      );
    }

    return (
      <Button
        className="h-10 w-full"
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
        <div aria-busy="true" className="space-y-2">
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
      <ul aria-label="Groups sorted by total buy-ins" className="space-y-2">
        {groups.map((group) => (
          <li key={group._id}>
            <Card
              className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4 p-5 md:gap-6 ${rowColumns}`}
            >
              <div className="col-span-2 min-w-0 md:col-span-1">
                <h2 className="break-words font-semibold text-base leading-snug">
                  {group.name}
                </h2>
                {group.description && (
                  <CardDescription
                    className="mt-1 line-clamp-1 break-words text-xs"
                    title={group.description}
                  >
                    {group.description}
                  </CardDescription>
                )}
                <p className="mt-1 text-muted-foreground text-xs">
                  {group.memberCount.toLocaleString("en-US")} members
                </p>
              </div>
              <div className="min-w-0 md:text-right">
                <p className="mb-1 text-muted-foreground text-xs md:sr-only">
                  Total buy-ins<span className="sr-only"> · All time</span>
                </p>
                <p className="break-words font-semibold text-lg tabular-nums tracking-tight sm:text-xl">
                  {currency.format(group.totalBuyIns)}
                </p>
              </div>
              <div className="min-w-0">
                {group.completedSessionCount === 0 ? (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    No completed sessions yet
                  </p>
                ) : (
                  <>
                    <p className="font-medium text-sm tabular-nums">
                      {group.completedSessionCount.toLocaleString("en-US")}{" "}
                      {group.completedSessionCount === 1
                        ? "session"
                        : "sessions"}
                      <span className="sr-only"> completed</span>
                    </p>
                    {group.lastCompletedSessionAt !== null ? (
                      <p className="mt-1 text-muted-foreground text-xs">
                        Last{" "}
                        <time
                          dateTime={new Date(
                            group.lastCompletedSessionAt
                          ).toISOString()}
                        >
                          {sessionDate.format(group.lastCompletedSessionAt)}
                        </time>
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="col-span-2 md:col-span-1">
                {renderCardAction(group)}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Find Groups</h1>
        <p className="mt-2 text-muted-foreground">
          Discover your next poker group.
        </p>
      </div>

      <DiscoveryVolumeSummary />

      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search groups by name"
          className="h-11 pl-10"
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search groups by name..."
          type="text"
          value={searchTerm}
        />
      </div>

      <section aria-label="Discover groups" className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-muted-foreground text-sm">
          <div aria-live="polite">
            {isLoading ? (
              <Skeleton
                aria-label="Loading result count"
                className="h-5 w-20"
              />
            ) : (
              `${groups.length.toLocaleString("en-US")} ${groups.length === 1 ? "group" : "groups"}`
            )}
          </div>
          <p className="flex items-center gap-1">
            Total buy-ins{" "}
            <ArrowDown aria-label="Highest first" className="h-3.5 w-3.5" />
          </p>
        </div>
        <div
          aria-hidden="true"
          className={`hidden items-center gap-6 px-5 pt-2 font-medium text-muted-foreground text-xs uppercase md:grid ${rowColumns}`}
        >
          <span>Group</span>
          <span className="text-right">Total buy-ins</span>
          <span>Sessions</span>
          <span />
        </div>
        {renderContent()}
      </section>

      <PaymentInfoModal
        onSuccess={handlePaymentSuccess}
        open={showPaymentModal}
      />
    </div>
  );
}
