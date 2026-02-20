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
import { GroupCardSkeleton } from "@/components/ui/skeleton";
import {
  useConvexUser,
  useDiscoverableGroups,
  useRequestToJoin,
  useSearchGroups,
} from "@/lib/convex-hooks";

export function GroupSearchClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [requestingGroupId, setRequestingGroupId] = useState<string | null>(
    null
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingJoinGroupId, setPendingJoinGroupId] = useState<string | null>(
    null
  );

  const { groups: searchResults, isLoading: searchLoading } = useSearchGroups(searchTerm);
  const { groups: discoverableGroups, isLoading: discoverableLoading } = useDiscoverableGroups();
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
          {Array.from({ length: 6 }).map((_, i) => (
            <GroupCardSkeleton key={i} />
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
            <p className="text-muted-foreground text-sm mt-2">
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
          <Card key={group._id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{group.name}</CardTitle>
              {group.description && (
                <CardDescription className="line-clamp-2">
                  {group.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
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

      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10"
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search groups by name..."
          type="text"
          value={searchTerm}
        />
      </div>

      {renderContent()}

      <PaymentInfoModal
        open={showPaymentModal}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
