"use client";

import { Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SessionFiltersProps {
  groups: Array<{ id: string; name: string }>;
}

export function SessionFilters({ groups }: SessionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleGroupChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("groupId");
    } else {
      params.set("groupId", value);
    }
    router.push(`/sessions?${params.toString()}`);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`/sessions?${params.toString()}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <CardTitle>Filters</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="font-medium text-sm">Group:</label>
            <Select
              defaultValue={searchParams.get("groupId") || "all"}
              onValueChange={handleGroupChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-medium text-sm">Status:</label>
            <Select
              defaultValue={searchParams.get("status") || "all"}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
