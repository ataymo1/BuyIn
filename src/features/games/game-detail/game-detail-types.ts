"use client";

import type { Id } from "../../../../convex/_generated/dataModel";

export interface EditingTransactionState {
  amount: string;
  id: Id<"transactions">;
  playerName: string;
  type: "buyin" | "cashout";
}

export interface EditingPlayerTotalsState {
  buyIn: string;
  cashOut: string;
  playerId: Id<"players">;
  playerName: string;
}

export interface GamePlayerRow {
  buyIn: number;
  cashOut?: number | null;
  id: string;
  player?: {
    id?: string | null;
    name?: string | null;
  } | null;
  playerId: string;
  profit?: number | null;
}

export interface GameTransactionRow {
  _creationTime: number;
  _id: string;
  amount: number;
  player?: {
    name?: string | null;
  } | null;
  status?: string;
  type: "buyin" | "cashout";
}

export interface PlayersSortState {
  direction: "asc" | "desc";
  key: "buyIn" | "cashOut" | "profit";
}
