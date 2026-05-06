import { rankHands } from "@xpressit/winning-poker-hand-rank";
import type { LivePokerSeat, LivePokerState, LivePokerWinner } from "./types";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["S", "H", "D", "C"];

interface RankResult {
  combination: string;
  rank: number;
}

function activeSeats(state: LivePokerState) {
  return state.seats.filter((seat): seat is LivePokerSeat =>
    Boolean(seat && !seat.sitOut)
  );
}

function handSeats(state: LivePokerState) {
  return state.seats.filter((seat): seat is LivePokerSeat =>
    Boolean(seat?.cards?.length)
  );
}

function nextSeatIndex(
  state: LivePokerState,
  from: number,
  predicate: (seat: LivePokerSeat) => boolean
) {
  for (let offset = 1; offset <= state.seatCount; offset += 1) {
    const index = (from + offset) % state.seatCount;
    const seat = state.seats[index];
    if (seat && predicate(seat)) {
      return index;
    }
  }

  return null;
}

function postBlind(seat: LivePokerSeat, amount: number) {
  const posted = Math.min(seat.stack, amount);
  seat.stack -= posted;
  seat.bet += posted;
  seat.committed += posted;
  seat.isAllIn = seat.stack === 0;
  return posted;
}

function resetStreet(state: LivePokerState) {
  state.currentBet = 0;
  for (const seat of state.seats) {
    if (seat) {
      seat.bet = 0;
      seat.hasActedThisStreet = false;
    }
  }
}

function firstActionSeat(state: LivePokerState, afterSeatIndex: number) {
  return nextSeatIndex(
    state,
    afterSeatIndex,
    (seat) => !(seat.folded || seat.isAllIn) && Boolean(seat.cards?.length)
  );
}

function isBettingRoundComplete(state: LivePokerState) {
  const liveSeats = handSeats(state).filter((seat) => !seat.folded);
  if (liveSeats.length <= 1) {
    return true;
  }

  return liveSeats.every(
    (seat) =>
      seat.isAllIn || (seat.bet === state.currentBet && seat.hasActedThisStreet)
  );
}

function shouldRunoutToShowdown(state: LivePokerState) {
  const liveSeats = handSeats(state).filter((seat) => !seat.folded);
  const seatsWithAction = liveSeats.filter((seat) => !seat.isAllIn);

  return (
    liveSeats.length > 1 &&
    seatsWithAction.length <= 1 &&
    liveSeats.every((seat) => seat.isAllIn || seat.bet === state.currentBet)
  );
}

function runoutToShowdown(state: LivePokerState) {
  while (state.communityCards.length < 5) {
    if (state.communityCards.length === 0) {
      state.communityCards.push(
        state.deck.pop() as string,
        state.deck.pop() as string,
        state.deck.pop() as string
      );
      state.actionLog.push("FLOP dealt");
      continue;
    }

    state.communityCards.push(state.deck.pop() as string);
    state.actionLog.push(
      state.communityCards.length === 4 ? "TURN dealt" : "RIVER dealt"
    );
  }

  state.phase = "showdown";
  state.activeSeatIndex = null;
}

export function createInitialState(config: {
  bigBlind: number;
  hostUserId: string;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}): LivePokerState {
  return {
    actionLog: [],
    activeSeatIndex: null,
    bigBlind: config.bigBlind,
    bigBlindSeatIndex: null,
    communityCards: [],
    currentBet: 0,
    dealerSeatIndex: null,
    deck: [],
    handNumber: 0,
    hostUserId: config.hostUserId,
    lastAggressorSeatIndex: null,
    lastWinners: [],
    maxBuyIn: config.maxBuyIn,
    minBuyIn: config.minBuyIn,
    minRaise: config.bigBlind,
    phase: "waiting",
    seatCount: config.seatCount,
    seats: Array.from({ length: config.seatCount }, () => null),
    smallBlind: config.smallBlind,
    smallBlindSeatIndex: null,
  };
}

export function createDeck() {
  return RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));
}

export function shuffleDeck(deck = createDeck()) {
  const copy = [...deck];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function seatPlayer(
  state: LivePokerState,
  seatIndex: number,
  player: {
    buyIn: number;
    name: string;
    playerId: string;
    userId: string;
  }
) {
  const existingSeat = state.seats.find(
    (seat) =>
      seat?.userId === player.userId || seat?.playerId === player.playerId
  );
  if (existingSeat) {
    throw new Error("You are already seated at this table");
  }

  if (state.seats[seatIndex]) {
    throw new Error("Seat is already occupied");
  }
  if (player.buyIn < state.minBuyIn || player.buyIn > state.maxBuyIn) {
    throw new Error(
      `Buy-in must be between ${state.minBuyIn} and ${state.maxBuyIn}`
    );
  }

  state.seats[seatIndex] = {
    bet: 0,
    buyIn: player.buyIn,
    committed: 0,
    connected: true,
    folded: false,
    hasActedThisStreet: false,
    isAllIn: false,
    name: player.name,
    playerId: player.playerId,
    ready: false,
    seatIndex,
    sitOut: false,
    stack: player.buyIn,
    userId: player.userId,
  };
  state.actionLog.push(`${player.name} sat in seat ${seatIndex + 1}`);
}

export function addChips(
  state: LivePokerState,
  userId: string,
  amount: number
) {
  if (state.phase !== "waiting") {
    throw new Error("You can add chips between hands");
  }

  const seat = state.seats.find((candidate) => candidate?.userId === userId);
  if (!seat) {
    throw new Error("Take a seat before adding chips");
  }

  if (amount <= 0) {
    throw new Error("Add-on amount must be positive");
  }

  const nextStack = seat.stack + amount;
  if (nextStack < state.minBuyIn || nextStack > state.maxBuyIn) {
    throw new Error(
      `Stack must be between ${state.minBuyIn} and ${state.maxBuyIn}`
    );
  }

  seat.buyIn += amount;
  seat.ready = false;
  seat.stack = nextStack;
  state.actionLog.push(`${seat.name} added ${amount} chips`);
}

export function startHand(state: LivePokerState) {
  const eligible = activeSeats(state).filter(
    (seat) => seat.stack > 0 && seat.ready
  );
  if (eligible.length < 2) {
    throw new Error(
      "At least two active ready players with chips are required"
    );
  }

  state.phase = "preflop";
  state.handNumber += 1;
  state.communityCards = [];
  state.deck = shuffleDeck();
  state.currentBet = 0;
  state.bigBlindSeatIndex = null;
  state.lastWinners = [];
  state.minRaise = state.bigBlind;
  state.smallBlindSeatIndex = null;
  state.lastAggressorSeatIndex = null;

  for (const seat of state.seats) {
    if (seat) {
      seat.bet = 0;
      seat.cards = undefined;
      seat.committed = 0;
      seat.folded = false;
      seat.hasActedThisStreet = false;
      seat.isAllIn = false;
    }
  }

  const previousDealer = state.dealerSeatIndex ?? -1;
  const dealerSeatIndex = nextSeatIndex(
    state,
    previousDealer,
    (seat) => !seat.sitOut && seat.stack > 0 && seat.ready
  );
  if (dealerSeatIndex === null) {
    throw new Error("No dealer seat available");
  }

  const smallBlindSeatIndex =
    eligible.length === 2
      ? dealerSeatIndex
      : nextSeatIndex(
          state,
          dealerSeatIndex,
          (seat) => !seat.sitOut && seat.stack > 0 && seat.ready
        );
  if (smallBlindSeatIndex === null) {
    throw new Error("No small blind seat available");
  }
  const bigBlindSeatIndex = nextSeatIndex(
    state,
    smallBlindSeatIndex,
    (seat) => !seat.sitOut && seat.stack > 0 && seat.ready
  );
  if (bigBlindSeatIndex === null) {
    throw new Error("No big blind seat available");
  }

  state.dealerSeatIndex = dealerSeatIndex;
  state.smallBlindSeatIndex = smallBlindSeatIndex;
  state.bigBlindSeatIndex = bigBlindSeatIndex;

  for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
    for (let offset = 0; offset < state.seatCount; offset += 1) {
      const index = (dealerSeatIndex + 1 + offset) % state.seatCount;
      const seat = state.seats[index];
      if (seat && !seat.sitOut && seat.stack > 0 && seat.ready) {
        seat.cards = [...(seat.cards ?? []), state.deck.pop() as string];
      }
    }
  }

  const smallBlindSeat = state.seats[smallBlindSeatIndex] as LivePokerSeat;
  const bigBlindSeat = state.seats[bigBlindSeatIndex] as LivePokerSeat;
  const postedSmallBlind = postBlind(smallBlindSeat, state.smallBlind);
  const postedBigBlind = postBlind(bigBlindSeat, state.bigBlind);
  state.currentBet = postedBigBlind;
  state.activeSeatIndex =
    firstActionSeat(state, bigBlindSeatIndex) ?? bigBlindSeatIndex;
  state.actionLog.push(`Hand ${state.handNumber} started`);
  state.actionLog.push(`${smallBlindSeat.name} posted ${postedSmallBlind}`);
  state.actionLog.push(`${bigBlindSeat.name} posted ${postedBigBlind}`);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Poker betting rules are clearer kept together at this layer.
export function applyAction(
  state: LivePokerState,
  userId: string,
  action:
    | { type: "fold" | "check" | "call" | "allIn" }
    | { type: "bet" | "raise"; amount: number }
) {
  const seatIndex = state.activeSeatIndex;
  if (
    seatIndex === null ||
    state.phase === "waiting" ||
    state.phase === "showdown"
  ) {
    throw new Error("No action is currently available");
  }

  const seat = state.seats[seatIndex];
  if (!seat || seat.userId !== userId) {
    throw new Error("It is not your turn");
  }

  const callAmount = Math.max(0, state.currentBet - seat.bet);

  if (action.type === "fold") {
    seat.folded = true;
    seat.hasActedThisStreet = true;
    state.actionLog.push(`${seat.name} folded`);
  } else if (action.type === "check") {
    if (callAmount > 0) {
      throw new Error("Cannot check while facing a bet");
    }
    seat.hasActedThisStreet = true;
    state.actionLog.push(`${seat.name} checked`);
  } else if (action.type === "call") {
    const paid = postBlind(seat, callAmount);
    seat.hasActedThisStreet = true;
    state.actionLog.push(`${seat.name} called ${paid}`);
  } else if (action.type === "bet" || action.type === "raise") {
    const targetBet = action.amount;
    const minTarget =
      state.currentBet === 0
        ? state.bigBlind
        : state.currentBet + state.minRaise;
    if (targetBet < minTarget && targetBet < seat.bet + seat.stack) {
      throw new Error(`Minimum ${action.type} is ${minTarget}`);
    }
    if (targetBet <= state.currentBet) {
      throw new Error("Bet must increase the current bet");
    }
    const paid = postBlind(seat, targetBet - seat.bet);
    const raiseSize = targetBet - state.currentBet;
    state.currentBet = seat.bet;
    state.minRaise = Math.max(raiseSize, state.bigBlind);
    state.lastAggressorSeatIndex = seatIndex;
    for (const otherSeat of handSeats(state)) {
      otherSeat.hasActedThisStreet = otherSeat.seatIndex === seatIndex;
    }
    state.actionLog.push(
      `${seat.name} ${action.type === "bet" ? "bet" : "raised to"} ${seat.bet}`
    );
    if (paid === 0) {
      throw new Error("Insufficient chips");
    }
  } else {
    const paid = postBlind(seat, seat.stack);
    if (seat.bet > state.currentBet) {
      const raiseSize = seat.bet - state.currentBet;
      state.currentBet = seat.bet;
      state.minRaise = Math.max(raiseSize, state.bigBlind);
      state.lastAggressorSeatIndex = seatIndex;
    }
    seat.hasActedThisStreet = true;
    state.actionLog.push(`${seat.name} moved all in for ${paid}`);
  }

  advanceAfterAction(state, seatIndex);
}

export function advanceAfterAction(
  state: LivePokerState,
  actedSeatIndex: number
) {
  const liveSeats = handSeats(state).filter((seat) => !seat.folded);
  if (liveSeats.length === 1) {
    state.phase = "showdown";
    state.activeSeatIndex = null;
    return;
  }

  if (shouldRunoutToShowdown(state)) {
    runoutToShowdown(state);
    return;
  }

  const nextIndex = firstActionSeat(state, actedSeatIndex);
  state.activeSeatIndex = nextIndex;

  if (!isBettingRoundComplete(state) || nextIndex === null) {
    return;
  }

  advanceStreet(state);
}

export function advanceStreet(state: LivePokerState) {
  resetStreet(state);

  if (state.phase === "preflop") {
    state.phase = "flop";
    state.communityCards.push(
      state.deck.pop() as string,
      state.deck.pop() as string,
      state.deck.pop() as string
    );
  } else if (state.phase === "flop") {
    state.phase = "turn";
    state.communityCards.push(state.deck.pop() as string);
  } else if (state.phase === "turn") {
    state.phase = "river";
    state.communityCards.push(state.deck.pop() as string);
  } else {
    state.phase = "showdown";
    state.activeSeatIndex = null;
    return;
  }

  state.actionLog.push(`${state.phase.toUpperCase()} dealt`);
  state.activeSeatIndex =
    state.dealerSeatIndex === null
      ? null
      : firstActionSeat(state, state.dealerSeatIndex);
  if (state.activeSeatIndex === null) {
    state.phase = "showdown";
  }
}

function buildSidePots(contenders: LivePokerSeat[]) {
  const levels = [...new Set(contenders.map((seat) => seat.committed))]
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  let previous = 0;

  return levels
    .map((level) => {
      const contributors = contenders.filter((seat) => seat.committed >= level);
      const eligible = contributors.filter((seat) => !seat.folded);
      const amount = (level - previous) * contributors.length;
      previous = level;
      return { amount, eligible };
    })
    .filter((pot) => pot.amount > 0 && pot.eligible.length > 0);
}

export function settleShowdown(state: LivePokerState) {
  const contenders = handSeats(state);
  const activeContenders = contenders.filter((seat) => !seat.folded);
  const winners: LivePokerWinner[] = [];

  while (state.communityCards.length < 5 && state.deck.length > 0) {
    state.communityCards.push(state.deck.pop() as string);
  }

  if (activeContenders.length === 1) {
    const winner = activeContenders[0];
    const pot = contenders.reduce((sum, seat) => sum + seat.committed, 0);
    winner.stack += pot;
    winners.push({
      amount: pot,
      playerId: winner.playerId,
      seatIndex: winner.seatIndex,
      userId: winner.userId,
    });
    state.actionLog.push(`${winner.name} won ${pot}`);
  } else {
    const sidePots = buildSidePots(contenders);
    for (const sidePot of sidePots) {
      const ranks = rankHands(
        "texas",
        state.communityCards as never,
        sidePot.eligible.map((seat) => seat.cards ?? []) as never
      ) as RankResult[];
      const bestRank = Math.min(...ranks.map((rank) => rank.rank));
      const potWinners = sidePot.eligible.filter(
        (_seat, index) => ranks[index].rank === bestRank
      );
      const share = Math.floor(sidePot.amount / potWinners.length);
      let remainder = sidePot.amount - share * potWinners.length;
      for (const winner of potWinners) {
        const amount = share + (remainder > 0 ? 1 : 0);
        remainder -= 1;
        winner.stack += amount;
        winners.push({
          amount,
          description: ranks[sidePot.eligible.indexOf(winner)]?.combination,
          playerId: winner.playerId,
          seatIndex: winner.seatIndex,
          userId: winner.userId,
        });
      }
    }
  }

  state.lastWinners = winners;
  for (const seat of state.seats) {
    if (seat) {
      seat.bet = 0;
      seat.committed = 0;
      seat.folded = false;
      seat.hasActedThisStreet = false;
      seat.isAllIn = false;
      seat.ready = false;
    }
  }

  state.phase = "waiting";
  state.activeSeatIndex = null;
  state.currentBet = 0;
  state.deck = [];
  return winners;
}

export function maybeStartNextHand(state: LivePokerState) {
  return (
    state.phase === "waiting" &&
    activeSeats(state).filter((seat) => seat.stack > 0 && seat.ready).length >=
      2
  );
}
