import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDisplayName(name?: string | null, email?: string | null) {
  const value = name?.trim() || email?.trim() || "Unknown";
  const atIndex = value.indexOf("@");

  if (atIndex > 0) {
    return value.slice(0, atIndex);
  }

  return value;
}
