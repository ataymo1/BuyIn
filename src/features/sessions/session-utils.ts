export function getProfitColorClass(profit: number): string {
  if (profit > 0) {
    return "text-green-600";
  }
  if (profit < 0) {
    return "text-red-600";
  }
  return "text-muted-foreground";
}

export function getStatusColorClass(status: string): string {
  if (status === "ACTIVE") {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }
  if (status === "COMPLETED") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
}

export function getGameTypeLabel(gameType?: string | null): string {
  return gameType === "tournament" ? "Tournament" : "Cash";
}
