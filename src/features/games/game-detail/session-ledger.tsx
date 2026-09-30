"use client";

import { Check, List, Users } from "lucide-react";
import { type ComponentProps, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatSessionMoney } from "./game-detail-utils";
import { PlayersCard } from "./players-card";
import { TransactionsCard } from "./transactions-card";

type SessionLedgerProps = ComponentProps<typeof PlayersCard> &
  ComponentProps<typeof TransactionsCard>;

const views = [
  { key: "players", label: "Player ledger", icon: Users },
  { key: "transactions", label: "Transaction history", icon: List },
] as const;
type View = (typeof views)[number]["key"];

export function SessionLedger(props: SessionLedgerProps) {
  const [view, setView] = useState<View>("players");
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const totalBoughtIn = props.transactions.reduce(
    (sum, transaction) =>
      transaction.type === "buyin" ? sum + transaction.amount : sum,
    0
  );
  const totalCashedOut = props.transactions.reduce(
    (sum, transaction) =>
      transaction.type === "cashout" ? sum + transaction.amount : sum,
    0
  );
  const differenceInCents = Math.round((totalCashedOut - totalBoughtIn) * 100);
  const totals = [
    { label: "Total bought in", value: totalBoughtIn },
    { label: "Total cashed out", value: totalCashedOut },
    { label: "Banker loss", value: Math.max(0, differenceInCents / 100) },
  ];

  return (
    <section aria-label="Session ledger" className="min-w-0 space-y-7">
      <dl className="grid grid-cols-3 divide-x rounded-xl border bg-muted/20 py-5">
        {totals.map(({ label, value }) => (
          <div className="min-w-0 px-2 sm:px-6" key={label}>
            <dt className="min-h-10 text-muted-foreground text-xs sm:min-h-0 sm:text-sm">
              {label}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-sm tabular-nums tracking-tight sm:text-2xl">
              {formatSessionMoney(value)}
              {label === "Banker loss" &&
              differenceInCents === 0 &&
              props.transactions.length > 0 ? (
                <span className="inline-flex items-center gap-1 font-normal text-green-600 text-xs tracking-normal dark:text-green-400">
                  <Check className="h-3 w-3" />
                  Balanced
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <div
          aria-label="Session view"
          className="flex gap-5 border-b sm:gap-8"
          role="tablist"
        >
          {views.map(({ key, label, icon: Icon }, index) => (
            <button
              aria-controls={`${id}-${key}-panel`}
              aria-selected={view === key}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 border-transparent border-b-2 pb-3 font-medium text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                view === key
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground"
              )}
              id={`${id}-${key}-tab`}
              key={key}
              onClick={() => setView(key)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === "ArrowRight") {
                  next = (index + 1) % views.length;
                } else if (event.key === "ArrowLeft") {
                  next = (index + views.length - 1) % views.length;
                } else if (event.key === "Home") {
                  next = 0;
                } else if (event.key === "End") {
                  next = views.length - 1;
                } else {
                  return;
                }
                event.preventDefault();
                setView(views[next].key);
                tabRefs.current[next]?.focus();
              }}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={view === key ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden="true" className="hidden h-4 w-4 sm:block" />
              {label}
              {key === "players" ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs tabular-nums">
                  {props.gamePlayers.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div
          aria-labelledby={`${id}-players-tab`}
          hidden={view !== "players"}
          id={`${id}-players-panel`}
          role="tabpanel"
        >
          <PlayersCard
            gamePlayers={props.gamePlayers}
            isSessionCreator={props.isSessionCreator}
            onEditPlayerTotals={props.onEditPlayerTotals}
          />
        </div>
        <div
          aria-labelledby={`${id}-transactions-tab`}
          hidden={view !== "transactions"}
          id={`${id}-transactions-panel`}
          role="tabpanel"
        >
          <TransactionsCard
            isDeletingTxId={props.isDeletingTxId}
            isSessionCreator={props.isSessionCreator}
            onDeleteTransaction={props.onDeleteTransaction}
            onEditTransaction={props.onEditTransaction}
            transactions={props.transactions}
          />
        </div>
      </div>
    </section>
  );
}
