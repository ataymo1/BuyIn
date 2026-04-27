"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  MobileCardSkeleton,
  Skeleton,
  TableRowSkeleton,
} from "@/components/ui/skeleton";

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
              {Array.from({ length: 3 }).map((_, index) => (
                <TableRowSkeleton key={index} columns={5} />
              ))}
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <MobileCardSkeleton key={index} />
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
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} columns={6} />
              ))}
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <MobileCardSkeleton key={index} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
