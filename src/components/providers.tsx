"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <ConvexProvider client={convex}>{children}</ConvexProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
