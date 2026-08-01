import { z } from "zod";

export const cardSchema = z.string().regex(/^[2-9TJQKA][SHDC]$/);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("joinTable") }),
  z.object({
    type: z.literal("sit"),
    seatIndex: z.number().int().min(0).max(8),
    buyIn: z.number().positive(),
  }),
  z.object({ type: z.literal("addChips"), amount: z.number().positive() }),
  z.object({ type: z.literal("leaveSeat") }),
  z.object({
    type: z.literal("kickSeat"),
    seatIndex: z.number().int().min(0).max(8),
  }),
  z.object({ type: z.literal("fold") }),
  z.object({ type: z.literal("check") }),
  z.object({ type: z.literal("call") }),
  z.object({ type: z.literal("bet"), amount: z.number().positive() }),
  z.object({ type: z.literal("raise"), amount: z.number().positive() }),
  z.object({ type: z.literal("allIn") }),
  z.object({ type: z.literal("sitOut"), sitOut: z.boolean() }),
  z.object({ type: z.literal("requestSync") }),
]);

export type LivePokerClientMessage = z.infer<typeof clientMessageSchema>;

export type LivePokerPhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export type LivePokerTransition =
  | "actionSettle"
  | "deal"
  | "nextHand"
  | "runout"
  | "showdown";

export type LivePokerStreetActionType =
  | "allIn"
  | "bet"
  | "bigBlind"
  | "call"
  | "check"
  | "fold"
  | "raise"
  | "smallBlind";

export interface LivePokerStreetAction {
  amount: number;
  type: LivePokerStreetActionType;
}

export interface LivePokerTableConfig {
  bigBlind: number;
  hostUserId: string;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}

export interface LivePokerAuthToken {
  exp: number;
  tableConfig: LivePokerTableConfig;
  tableId: string;
  playerId: string;
  playerName: string;
  userId: string;
}

export interface LivePokerSeat {
  bet: number;
  buyIn: number;
  cards?: string[];
  committed: number;
  connected: boolean;
  folded: boolean;
  hasActedThisStreet: boolean;
  isAllIn: boolean;
  name: string;
  playerId: string;
  seatIndex: number;
  sitOut: boolean;
  stack: number;
  streetAction?: LivePokerStreetAction;
  timeBankRemainingMs: number;
  userId: string;
}

export interface PublicLivePokerSeat
  extends Omit<LivePokerSeat, "cards" | "userId"> {
  cards?: string[];
  hasCards: boolean;
  isCurrentUser: boolean;
}

export interface LivePokerWinner {
  amount: number;
  description?: string;
  playerId: string;
  seatIndex: number;
  userId: string;
}

export type PublicLivePokerWinner = Omit<LivePokerWinner, "userId">;

export interface LivePokerSettledAction extends LivePokerStreetAction {
  seatIndex: number;
}

export interface LivePokerState {
  actionLog: string[];
  admissionsClosed?: boolean;
  appliedRequestIds?: string[];
  activeSeatIndex: number | null;
  bigBlind: number;
  bigBlindSeatIndex: number | null;
  communityCards: string[];
  currentBet: number;
  dealerSeatIndex: number | null;
  deck: string[];
  handNumber: number;
  hostUserId: string;
  lastAggressorSeatIndex: number | null;
  lastWinners: LivePokerWinner[];
  minBuyIn: number;
  maxBuyIn: number;
  minRaise: number;
  phase: LivePokerPhase;
  seatCount: number;
  seats: Array<LivePokerSeat | null>;
  settledAction?: LivePokerSettledAction | null;
  showdownPot?: number | null;
  showdownSeatIndexes?: number[];
  showdownSettled?: boolean;
  smallBlind: number;
  smallBlindSeatIndex: number | null;
  timeBankActive?: boolean;
  transition?: LivePokerTransition | null;
  transitionDeadlineAt?: number | null;
  turnDeadlineAt?: number | null;
  turnStartedAt?: number | null;
  runoutPending?: boolean;
}

export interface PublicLivePokerState {
  actionLog: string[];
  activeSeatIndex: number | null;
  bigBlind: number;
  bigBlindSeatIndex: number | null;
  communityCards: string[];
  currentBet: number;
  dealerSeatIndex: number | null;
  handNumber: number;
  isHost: boolean;
  lastWinners: PublicLivePokerWinner[];
  maxBuyIn: number;
  minBuyIn: number;
  minRaise: number;
  phase: LivePokerPhase;
  pot: number;
  seatCount: number;
  seats: Array<PublicLivePokerSeat | null>;
  serverTimeAt: number;
  settledAction: LivePokerSettledAction | null;
  showdownSeatIndexes: number[];
  smallBlind: number;
  smallBlindSeatIndex: number | null;
  timeBankActive: boolean;
  transition: LivePokerTransition | null;
  transitionDeadlineAt: number | null;
  turnDeadlineAt: number | null;
  turnStartedAt: number | null;
}

export type LivePokerServerMessage =
  | { type: "tableState"; state: PublicLivePokerState }
  | { type: "privateCards"; cards: string[] }
  | { type: "actionRejected"; message: string }
  | { type: "handStarted"; handNumber: number }
  | { type: "handEnded"; winners: PublicLivePokerWinner[] }
  | { type: "playerPresence"; userId: string; connected: boolean }
  | { type: "ledgerUpdated"; playerId: string; stack: number; buyIn: number };

export function calculatePot(state: Pick<LivePokerState, "seats">) {
  return state.seats.reduce((sum, seat) => sum + (seat?.committed ?? 0), 0);
}

export function toPublicState(
  state: LivePokerState,
  currentUserId: string,
  serverTimeAt = Date.now()
): PublicLivePokerState {
  const showdownSeatIndexes = state.showdownSeatIndexes ?? [];

  return {
    actionLog: state.actionLog.slice(-80),
    activeSeatIndex: state.activeSeatIndex,
    bigBlind: state.bigBlind,
    bigBlindSeatIndex: state.bigBlindSeatIndex ?? null,
    communityCards: state.communityCards,
    currentBet: state.currentBet,
    dealerSeatIndex: state.dealerSeatIndex,
    handNumber: state.handNumber,
    isHost: state.hostUserId === currentUserId,
    lastWinners: (state.lastWinners ?? []).map(
      ({ userId: _userId, ...winner }) => winner
    ),
    maxBuyIn: state.maxBuyIn,
    minBuyIn: state.minBuyIn,
    minRaise: state.minRaise,
    phase: state.phase,
    pot:
      state.phase === "showdown"
        ? (state.showdownPot ?? calculatePot(state))
        : calculatePot(state),
    seatCount: state.seatCount,
    seats: state.seats.map((seat) => {
      if (!seat) {
        return null;
      }

      const canShowCards =
        (state.phase !== "waiting" && seat.userId === currentUserId) ||
        showdownSeatIndexes.includes(seat.seatIndex);

      return {
        bet: seat.bet,
        buyIn: seat.buyIn,
        cards: canShowCards ? seat.cards : undefined,
        committed: seat.committed,
        connected: seat.connected,
        folded: seat.folded,
        hasActedThisStreet: seat.hasActedThisStreet,
        hasCards: Boolean(seat.cards?.length),
        isAllIn: seat.isAllIn,
        isCurrentUser: seat.userId === currentUserId,
        name: seat.name,
        playerId: seat.playerId,
        seatIndex: seat.seatIndex,
        sitOut: seat.sitOut,
        stack: seat.stack,
        streetAction: seat.streetAction,
        timeBankRemainingMs:
          state.timeBankActive &&
          state.activeSeatIndex === seat.seatIndex &&
          state.turnDeadlineAt !== null &&
          state.turnDeadlineAt !== undefined
            ? Math.min(
                seat.timeBankRemainingMs,
                Math.max(0, state.turnDeadlineAt - serverTimeAt)
              )
            : seat.timeBankRemainingMs,
      };
    }),
    serverTimeAt,
    settledAction: state.settledAction ?? null,
    showdownSeatIndexes,
    smallBlind: state.smallBlind,
    smallBlindSeatIndex: state.smallBlindSeatIndex ?? null,
    timeBankActive: state.timeBankActive ?? false,
    transition: state.transition ?? null,
    transitionDeadlineAt: state.transitionDeadlineAt ?? null,
    turnDeadlineAt: state.turnDeadlineAt ?? null,
    turnStartedAt: state.turnStartedAt ?? null,
  };
}
