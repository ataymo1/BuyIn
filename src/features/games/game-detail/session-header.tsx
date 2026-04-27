"use client";

import { format } from "date-fns";
import {
  Banknote,
  Edit2,
  MoreVertical,
  PiggyBank,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getStatusColorClass } from "./game-detail-utils";

interface SessionHeaderProps {
  canManage: boolean;
  createdByName?: string | null;
  date: number;
  gameType?: "cash" | "tournament";
  group?: {
    id: string;
    name: string;
  } | null;
  isJoined: boolean;
  isSessionCreator: boolean;
  location?: string | null;
  onDeleteClick: () => void;
  onEditClick: () => void;
  onJoinClick: () => void;
  onStatusChange: (status: "ACTIVE" | "COMPLETED") => void;
  status: string;
}

function ActionsMenu({
  onDeleteClick,
  onEditClick,
  onStatusChange,
  status,
}: {
  onDeleteClick: () => void;
  onEditClick: () => void;
  onStatusChange: (status: "ACTIVE" | "COMPLETED") => void;
  status: string;
}) {
  return (
    <div className="p-1">
      <button
        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
        onClick={onEditClick}
        type="button"
      >
        <Edit2 className="h-4 w-4" />
        Edit Session
      </button>

      {status !== "ACTIVE" ? (
        <button
          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
          onClick={() => onStatusChange("ACTIVE")}
          type="button"
        >
          Mark as Active
        </button>
      ) : null}

      {status !== "COMPLETED" ? (
        <button
          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
          onClick={() => onStatusChange("COMPLETED")}
          type="button"
        >
          Mark as Completed
        </button>
      ) : null}

      <div className="my-1 h-px bg-border" />

      <button
        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={onDeleteClick}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
        Delete Session
      </button>
    </div>
  );
}

export function SessionHeader({
  canManage,
  createdByName,
  date,
  gameType = "cash",
  group,
  isJoined,
  isSessionCreator,
  location,
  onDeleteClick,
  onEditClick,
  onJoinClick,
  onStatusChange,
  status,
}: SessionHeaderProps) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  function closeActionsMenu() {
    setShowActionsMenu(false);
  }

  function handleEditClick() {
    closeActionsMenu();
    onEditClick();
  }

  function handleDeleteClick() {
    closeActionsMenu();
    onDeleteClick();
  }

  function handleStatusChange(nextStatus: "ACTIVE" | "COMPLETED") {
    closeActionsMenu();
    onStatusChange(nextStatus);
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-2xl sm:text-3xl">
                Session Details
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${getStatusColorClass(status)}`}
              >
                {status}
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-1 font-medium text-violet-800 text-xs dark:bg-violet-900 dark:text-violet-200">
                {gameType === "tournament" ? "Tournament" : "Cash Game"}
              </span>
              {isSessionCreator ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800 text-xs dark:bg-amber-900 dark:text-amber-200">
                  <Banknote className="h-3 w-3" />
                  Banker
                </span>
              ) : null}
            </div>

            {canManage ? (
              <div className="relative flex-shrink-0 sm:hidden">
                <Button
                  onClick={() => setShowActionsMenu((current) => !current)}
                  size="sm"
                  variant="outline"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showActionsMenu ? (
                  <div className="fixed inset-x-4 bottom-20 z-50 w-auto rounded-md border bg-background shadow-lg">
                    <ActionsMenu
                      onDeleteClick={handleDeleteClick}
                      onEditClick={handleEditClick}
                      onStatusChange={handleStatusChange}
                      status={status}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="mt-1 text-muted-foreground text-sm sm:text-base">
            {format(new Date(date), "MMMM dd, yyyy")}
            {location ? (
              <span className="hidden sm:inline"> | {location}</span>
            ) : null}
            {group ? (
              <>
                {" | "}
                <Link
                  className="inline-flex items-center gap-1 hover:underline"
                  href={`/groups/${group.id}`}
                >
                  <Users className="h-3 w-3" />
                  {group.name}
                </Link>
              </>
            ) : null}
            {createdByName ? (
              <>
                {" | "}
                <span className="inline-flex items-center gap-1">
                  <PiggyBank className="h-3 w-3 text-amber-600" />
                  <span>
                    Banker: {createdByName}
                    {isSessionCreator ? (
                      <span className="ml-1 text-amber-600">(You)</span>
                    ) : null}
                  </span>
                </span>
              </>
            ) : null}
          </p>

          {location ? (
            <p className="mt-1 text-muted-foreground text-sm sm:hidden">
              {location}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {status === "ACTIVE" && !isJoined ? (
            <Button className="flex-1 sm:flex-none" onClick={onJoinClick}>
              Join Session
            </Button>
          ) : null}

          {canManage ? (
            <div className="relative hidden sm:block">
              <Button
                onClick={() => setShowActionsMenu((current) => !current)}
                size="sm"
                variant="outline"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {showActionsMenu ? (
                <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border bg-background shadow-lg">
                  <ActionsMenu
                    onDeleteClick={handleDeleteClick}
                    onEditClick={handleEditClick}
                    onStatusChange={handleStatusChange}
                    status={status}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {showActionsMenu ? (
        <button
          aria-label="Close session actions menu"
          className="fixed inset-0 z-40"
          onClick={closeActionsMenu}
          onKeyDown={(event) =>
            event.key === "Escape" ? closeActionsMenu() : undefined
          }
          type="button"
        />
      ) : null}
    </>
  );
}
