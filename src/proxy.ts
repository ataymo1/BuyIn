import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: Request) {
  const session = await auth();

  // If user is not authenticated, redirect to login
  // Note: Profile completion check is handled in layouts/pages (Node.js runtime)
  // since Prisma Client doesn't work in Edge runtime
  if (!session?.user?.id) {
    const url = new URL("/login", new URL(request.url).origin);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|profile/setup).*)",
  ],
};
