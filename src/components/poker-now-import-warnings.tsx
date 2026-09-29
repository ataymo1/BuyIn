import type { PokerNowSession } from "@/lib/poker-now/parser";

export function PokerNowImportWarnings({
  warnings,
}: {
  warnings: PokerNowSession["warnings"];
}) {
  if (!warnings?.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md bg-amber-500/10 p-3 text-amber-900 text-sm dark:text-amber-200">
      <p className="font-medium">Review incomplete session timing</p>
      <ul className="list-disc space-y-1 pl-5">
        {warnings.map((warning) => (
          <li key={warning.rowNumber}>
            Row {warning.rowNumber}: {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
