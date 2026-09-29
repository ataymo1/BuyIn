"use client";

import { Button } from "@/components/ui/button";

export default function GroupSearchError({ reset }: { reset: () => void }) {
  return (
    <div className="container mx-auto max-w-xl space-y-4 px-4 py-16">
      <h1 className="font-semibold text-2xl">Couldn’t load groups</h1>
      <p className="text-muted-foreground" role="alert">
        Group details and buy-in totals are unavailable right now. Please try
        again.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
