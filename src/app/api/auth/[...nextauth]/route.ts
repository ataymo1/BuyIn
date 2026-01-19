import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";
