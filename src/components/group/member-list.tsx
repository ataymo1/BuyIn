"use client";

import { Crown, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDisplayName } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Member {
  id: string;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface MemberListProps {
  members: Member[];
  groupId: string;
  isOwner: boolean;
  currentUserId: string;
  onInvite: (email: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

export function MemberList({
  members,
  groupId,
  isOwner,
  currentUserId,
  onInvite,
  onRemove,
}: MemberListProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    try {
      await onInvite(inviteEmail.trim());
      setInviteEmail("");
      setIsInviteDialogOpen(false);
    } catch (error) {
      console.error("Error inviting member:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await onRemove(userId);
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>Group members and their roles</CardDescription>
          </div>
          {isOwner && (
            <Dialog
              onOpenChange={setIsInviteDialogOpen}
              open={isInviteDialogOpen}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                  <DialogDescription>
                    Enter the email address of the user you want to invite to
                    this group.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleInvite}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                      type="email"
                      value={inviteEmail}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setIsInviteDialogOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button disabled={isSubmitting} type="submit">
                      {isSubmitting ? "Inviting..." : "Invite"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    <Link
                      className="block max-w-[180px] truncate hover:underline"
                      href={`/players/${member.user.id}`}
                      title={getDisplayName(member.user.name, member.user.email)}
                    >
                      {getDisplayName(member.user.name, member.user.email)}
                    </Link>
                  </TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {member.role === "OWNER" && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      <span>{member.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/players/${member.user.id}`}>
                          <Button size="sm" variant="outline">
                            View Stats
                          </Button>
                        </Link>
                        {member.user.id !== currentUserId &&
                          member.role !== "OWNER" && (
                            <Button
                              onClick={() => handleRemove(member.user.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  )}
                  {!isOwner && (
                    <TableCell>
                      <Link href={`/players/${member.user.id}`}>
                        <Button size="sm" variant="outline">
                          View Stats
                        </Button>
                      </Link>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
