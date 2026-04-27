"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  MobileCardSkeleton,
  Skeleton,
  TableRowSkeleton,
} from "@/components/ui/skeleton";

const activeSessionRows = [
  "active-session-row-1",
  "active-session-row-2",
  "active-session-row-3",
];
const historySessionRows = [
  "history-session-row-1",
  "history-session-row-2",
  "history-session-row-3",
  "history-session-row-4",
  "history-session-row-5",
];

export function SessionsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block">
              {activeSessionRows.map((rowKey) => (
                <TableRowSkeleton columns={5} key={rowKey} />
              ))}
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {activeSessionRows.map((rowKey) => (
                <MobileCardSkeleton key={rowKey} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block">
              {historySessionRows.map((rowKey) => (
                <TableRowSkeleton columns={6} key={rowKey} />
              ))}
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {historySessionRows.map((rowKey) => (
                <MobileCardSkeleton key={rowKey} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
