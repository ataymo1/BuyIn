"use client";

import { Skeleton, TableRowSkeleton } from "@/components/ui/skeleton";

const playerRows = [
  "player-row-1",
  "player-row-2",
  "player-row-3",
  "player-row-4",
];
const totals = ["buy-in", "cash-out", "banker-loss"];

export function GameDetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-3 divide-x rounded-xl border py-5">
        {totals.map((total) => (
          <div className="space-y-3 px-3 sm:px-6" key={total}>
            <Skeleton className="h-4 w-full max-w-28" />
            <Skeleton className="h-7 w-full max-w-36" />
          </div>
        ))}
      </div>
      <div>
        <div className="mb-5 flex gap-6 border-b pb-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="mb-5 h-4 w-full max-w-72" />
        {playerRows.map((row) => (
          <TableRowSkeleton columns={4} key={row} />
        ))}
      </div>
      <div className="rounded-xl border p-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-3 w-56" />
      </div>
    </div>
  );
}
