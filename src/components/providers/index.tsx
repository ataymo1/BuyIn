"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { NotificationProvider } from "./notification-provider";
import { ThemeProvider } from "./theme-provider";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

const convex = new ConvexReactClient(convexUrl);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <ConvexProvider client={convex}>
          <NotificationProvider>{children}</NotificationProvider>
        </ConvexProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
