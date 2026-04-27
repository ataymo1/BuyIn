export interface SessionGroupSummary {
  id?: string;
  name?: string;
}

export interface SessionCreatorSummary {
  id?: string;
  name?: string;
}

export interface SessionListItem {
  id: string;
  date: number | string;
  status: string;
  location?: string | null;
  gameType?: "cash" | "tournament" | string | null;
  group?: SessionGroupSummary | null;
  createdBy?: SessionCreatorSummary | null;
  gamePlayers?: Array<unknown> | null;
  userProfit: number | null;
  isParticipant: boolean;
}
