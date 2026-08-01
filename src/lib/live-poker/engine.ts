import { rankHands } from "@xpressit/winning-poker-hand-rank";
import { LIVE_POKER_TIME_BANK_MS } from "./timing";
import type { LivePokerSeat, LivePokerState, LivePokerWinner } from "./types";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["S", "H", "D", "C"];

// Live table amounts are currency-denominated (the UI accepts hundredths).
const CHIP_UNITS_PER_AMOUNT = 100;

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

function toChipUnits(amount: number, label = "Chip amount") {
  const units = Math.round(amount * CHIP_UNITS_PER_AMOUNT);
  if (
    !(Number.isFinite(amount) && Number.isSafeInteger(units)) ||
    Math.abs(amount * CHIP_UNITS_PER_AMOUNT - units) > 1e-7
  ) {
    throw new Error(`${label} must use increments of 0.01`);
  }
  return units;
}

function fromChipUnits(units: number) {
  return units / CHIP_UNITS_PER_AMOUNT;
}

function validateChipAmount(
  amount: number,
  label: string,
  { allowZero = false }: { allowZero?: boolean } = {}
) {
  const units = toChipUnits(amount, label);
  if (allowZero ? units < 0 : units <= 0) {
    throw new Error(
      `${label} must be ${allowZero ? "non-negative" : "positive"}`
    );
  }
  return fromChipUnits(units);
}

function postBlind(seat: LivePokerSeat, amount: number) {
  const stackUnits = toChipUnits(seat.stack);
  const postedUnits = Math.min(stackUnits, toChipUnits(amount));
  const posted = fromChipUnits(postedUnits);
  seat.stack = fromChipUnits(stackUnits - postedUnits);
  seat.bet = fromChipUnits(toChipUnits(seat.bet) + postedUnits);
  seat.committed = fromChipUnits(toChipUnits(seat.committed) + postedUnits);
  seat.isAllIn = seat.stack === 0;
  return posted;
}

function resetStreet(state: LivePokerState) {
  state.currentBet = 0;
  for (const seat of state.seats) {
    if (seat) {
      seat.bet = 0;
      seat.hasActedThisStreet = false;
      seat.streetAction = undefined;
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

function beginRunout(state: LivePokerState) {
  state.activeSeatIndex = null;
  state.runoutPending = true;
}

export function revealNextRunoutStage(state: LivePokerState) {
  if (!state.runoutPending) {
    throw new Error("No board runout is pending");
  }

  if (state.communityCards.length === 0) {
    state.phase = "flop";
    state.communityCards.push(
      state.deck.pop() as string,
      state.deck.pop() as string,
      state.deck.pop() as string
    );
    state.actionLog.push("FLOP dealt");
    return;
  }

  if (state.communityCards.length === 3) {
    state.phase = "turn";
    state.communityCards.push(state.deck.pop() as string);
    state.actionLog.push("TURN dealt");
    return;
  }

  if (state.communityCards.length === 4) {
    state.communityCards.push(state.deck.pop() as string);
    state.actionLog.push("RIVER dealt");
  }

  state.phase = "showdown";
  state.activeSeatIndex = null;
  state.runoutPending = false;
}

export function createInitialState(config: {
  bigBlind: number;
  hostUserId: string;
  maxBuyIn: number;
  minBuyIn: number;
  seatCount: number;
  smallBlind: number;
}): LivePokerState {
  const smallBlind = validateChipAmount(config.smallBlind, "Small blind");
  const bigBlind = validateChipAmount(config.bigBlind, "Big blind");
  const minBuyIn = validateChipAmount(config.minBuyIn, "Minimum buy-in", {
    allowZero: true,
  });
  const maxBuyIn = validateChipAmount(config.maxBuyIn, "Maximum buy-in");
  if (bigBlind < smallBlind) {
    throw new Error("Big blind must be at least the small blind");
  }
  if (maxBuyIn < minBuyIn) {
    throw new Error("Maximum buy-in must be at least the minimum buy-in");
  }

  return {
    actionLog: [],
    activeSeatIndex: null,
    bigBlind,
    bigBlindSeatIndex: null,
    communityCards: [],
    currentBet: 0,
    dealerSeatIndex: null,
    deck: [],
    handNumber: 0,
    hostUserId: config.hostUserId,
    lastAggressorSeatIndex: null,
    lastWinners: [],
    maxBuyIn,
    minBuyIn,
    minRaise: bigBlind,
    phase: "waiting",
    seatCount: config.seatCount,
    seats: Array.from({ length: config.seatCount }, () => null),
    settledAction: null,
    showdownPot: null,
    showdownSeatIndexes: [],
    showdownSettled: false,
    smallBlind,
    smallBlindSeatIndex: null,
    timeBankActive: false,
    transition: null,
    transitionDeadlineAt: null,
    turnDeadlineAt: null,
    turnStartedAt: null,
    runoutPending: false,
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
  const buyIn = validateChipAmount(player.buyIn, "Buy-in");
  if (buyIn < state.minBuyIn || buyIn > state.maxBuyIn) {
    throw new Error(
      `Buy-in must be between ${state.minBuyIn} and ${state.maxBuyIn}`
    );
  }

  state.seats[seatIndex] = {
    bet: 0,
    buyIn,
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
    stack: buyIn,
    streetAction: undefined,
    timeBankRemainingMs: LIVE_POKER_TIME_BANK_MS,
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

  const addOn = validateChipAmount(amount, "Add-on amount");
  const nextStack = fromChipUnits(toChipUnits(seat.stack) + toChipUnits(addOn));
  if (nextStack < state.minBuyIn || nextStack > state.maxBuyIn) {
    throw new Error(
      `Stack must be between ${state.minBuyIn} and ${state.maxBuyIn}`
    );
  }

  seat.buyIn = fromChipUnits(toChipUnits(seat.buyIn) + toChipUnits(addOn));
  seat.ready = false;
  seat.stack = nextStack;
  state.actionLog.push(`${seat.name} added ${addOn} chips`);
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
  state.runoutPending = false;
  state.settledAction = null;
  state.showdownPot = null;
  state.showdownSeatIndexes = [];
  state.showdownSettled = false;
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
      seat.streetAction = undefined;
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
  smallBlindSeat.streetAction = {
    amount: smallBlindSeat.bet,
    type: "smallBlind",
  };
  bigBlindSeat.streetAction = {
    amount: bigBlindSeat.bet,
    type: "bigBlind",
  };
  // A short big blind does not reduce the nominal preflop bring-in.
  state.currentBet = state.bigBlind;
  state.activeSeatIndex = firstActionSeat(state, bigBlindSeatIndex);
  state.actionLog.push(`Hand ${state.handNumber} started`);
  state.actionLog.push(`${smallBlindSeat.name} posted ${postedSmallBlind}`);
  state.actionLog.push(`${bigBlindSeat.name} posted ${postedBigBlind}`);

  if (state.activeSeatIndex === null || shouldRunoutToShowdown(state)) {
    beginRunout(state);
  }
}

function reopenBettingAfterFullRaise(
  state: LivePokerState,
  aggressorSeatIndex: number
) {
  for (const otherSeat of handSeats(state)) {
    otherSeat.hasActedThisStreet = otherSeat.seatIndex === aggressorSeatIndex;
  }
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

  const currentBetUnits = toChipUnits(state.currentBet);
  const seatBetUnits = toChipUnits(seat.bet);
  const maxTargetUnits = seatBetUnits + toChipUnits(seat.stack);
  const callAmount = fromChipUnits(Math.max(0, currentBetUnits - seatBetUnits));

  if (action.type === "fold") {
    seat.folded = true;
    seat.hasActedThisStreet = true;
    seat.streetAction = { amount: seat.bet, type: "fold" };
    state.actionLog.push(`${seat.name} folded`);
  } else if (action.type === "check") {
    if (callAmount > 0) {
      throw new Error("Cannot check while facing a bet");
    }
    seat.hasActedThisStreet = true;
    seat.streetAction = { amount: seat.bet, type: "check" };
    state.actionLog.push(`${seat.name} checked`);
  } else if (action.type === "call") {
    const paid = postBlind(seat, callAmount);
    seat.hasActedThisStreet = true;
    seat.streetAction = { amount: seat.bet, type: "call" };
    state.actionLog.push(`${seat.name} called ${paid}`);
  } else if (action.type === "bet" || action.type === "raise") {
    const targetBet = validateChipAmount(action.amount, "Bet target");
    const targetBetUnits = toChipUnits(targetBet);

    // Validate the actual stack cap before postBlind can mutate the seat.
    if (targetBetUnits > maxTargetUnits) {
      throw new Error("Bet target exceeds available stack");
    }
    if (targetBetUnits <= currentBetUnits) {
      throw new Error("Bet must increase the current bet");
    }
    if (seat.hasActedThisStreet) {
      throw new Error("Betting has not been reopened");
    }

    const minTargetUnits =
      currentBetUnits === 0
        ? toChipUnits(state.bigBlind)
        : currentBetUnits + toChipUnits(state.minRaise);
    if (targetBetUnits < minTargetUnits && targetBetUnits !== maxTargetUnits) {
      throw new Error(
        `Minimum ${action.type} is ${fromChipUnits(minTargetUnits)}`
      );
    }

    const raiseSizeUnits = targetBetUnits - currentBetUnits;
    postBlind(seat, fromChipUnits(targetBetUnits - seatBetUnits));
    state.currentBet = targetBet;
    state.lastAggressorSeatIndex = seatIndex;
    if (raiseSizeUnits >= toChipUnits(state.minRaise)) {
      state.minRaise = fromChipUnits(raiseSizeUnits);
      reopenBettingAfterFullRaise(state, seatIndex);
    } else {
      seat.hasActedThisStreet = true;
    }
    seat.streetAction = { amount: seat.bet, type: action.type };
    state.actionLog.push(
      `${seat.name} ${action.type === "bet" ? "bet" : "raised to"} ${seat.bet}`
    );
  } else {
    if (maxTargetUnits > currentBetUnits && seat.hasActedThisStreet) {
      throw new Error("Betting has not been reopened");
    }

    const paid = postBlind(seat, seat.stack);
    if (maxTargetUnits > currentBetUnits) {
      const raiseSizeUnits = maxTargetUnits - currentBetUnits;
      state.currentBet = fromChipUnits(maxTargetUnits);
      state.lastAggressorSeatIndex = seatIndex;
      if (raiseSizeUnits >= toChipUnits(state.minRaise)) {
        state.minRaise = fromChipUnits(raiseSizeUnits);
        reopenBettingAfterFullRaise(state, seatIndex);
      }
    }
    seat.hasActedThisStreet = true;
    seat.streetAction = { amount: seat.bet, type: "allIn" };
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
    beginRunout(state);
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
  const levels = [
    ...new Set(contenders.map((seat) => toChipUnits(seat.committed))),
  ]
    .filter((units) => units > 0)
    .sort((a, b) => a - b);
  let previousUnits = 0;

  return levels
    .map((levelUnits) => {
      const contributors = contenders.filter(
        (seat) => toChipUnits(seat.committed) >= levelUnits
      );
      const eligible = contributors.filter((seat) => !seat.folded);
      const amountUnits = (levelUnits - previousUnits) * contributors.length;
      previousUnits = levelUnits;
      return { amountUnits, eligible };
    })
    .filter((pot) => pot.amountUnits > 0);
}

function payoutOrder(state: LivePokerState, seats: LivePokerSeat[]) {
  if (state.dealerSeatIndex === null) {
    return [...seats].sort((a, b) => a.seatIndex - b.seatIndex);
  }

  const distanceFromDealer = (seat: LivePokerSeat) => {
    const distance =
      (seat.seatIndex - (state.dealerSeatIndex as number) + state.seatCount) %
      state.seatCount;
    return distance === 0 ? state.seatCount : distance;
  };

  return [...seats].sort(
    (a, b) => distanceFromDealer(a) - distanceFromDealer(b)
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Side-pot ranking and exact-unit payouts are kept together to make conservation auditable.
export function settleShowdown(state: LivePokerState) {
  if (state.showdownSettled) {
    return state.lastWinners;
  }

  const contenders = handSeats(state);
  const activeContenders = contenders.filter((seat) => !seat.folded);
  const winners: LivePokerWinner[] = [];
  state.showdownSeatIndexes =
    activeContenders.length > 1
      ? activeContenders.map((seat) => seat.seatIndex)
      : [];

  while (
    activeContenders.length > 1 &&
    state.communityCards.length < 5 &&
    state.deck.length > 0
  ) {
    state.communityCards.push(state.deck.pop() as string);
  }

  const potUnits = contenders.reduce(
    (sum, seat) => sum + toChipUnits(seat.committed),
    0
  );
  let awardedUnits = 0;

  if (activeContenders.length === 1) {
    const winner = activeContenders[0];
    winner.stack = fromChipUnits(toChipUnits(winner.stack) + potUnits);
    awardedUnits = potUnits;
    const pot = fromChipUnits(potUnits);
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
      // A zero-eligible layer is not reachable through legal betting, but dead
      // chips still belong to the remaining live hand rather than disappearing.
      const eligible =
        sidePot.eligible.length > 0 ? sidePot.eligible : activeContenders;
      const ranks = rankHands(
        "texas",
        state.communityCards as never,
        eligible.map((seat) => seat.cards ?? []) as never
      ) as RankResult[];
      const bestRank = Math.min(...ranks.map((rank) => rank.rank));
      const tiedWinners = eligible.filter(
        (_seat, index) => ranks[index].rank === bestRank
      );
      const potWinners = payoutOrder(state, tiedWinners);
      const shareUnits = Math.floor(sidePot.amountUnits / potWinners.length);
      let remainderUnits = sidePot.amountUnits - shareUnits * potWinners.length;
      for (const winner of potWinners) {
        const winnerUnits = shareUnits + (remainderUnits > 0 ? 1 : 0);
        remainderUnits = Math.max(0, remainderUnits - 1);
        const amount = fromChipUnits(winnerUnits);
        winner.stack = fromChipUnits(toChipUnits(winner.stack) + winnerUnits);
        awardedUnits += winnerUnits;
        winners.push({
          amount,
          description: ranks[eligible.indexOf(winner)]?.combination,
          playerId: winner.playerId,
          seatIndex: winner.seatIndex,
          userId: winner.userId,
        });
      }
    }
  }

  if (awardedUnits !== potUnits) {
    throw new Error("Showdown payouts did not conserve the pot");
  }

  state.lastWinners = winners;
  state.showdownPot = fromChipUnits(potUnits);
  state.showdownSettled = true;
  state.phase = "showdown";
  state.activeSeatIndex = null;
  state.currentBet = 0;
  state.runoutPending = false;
  for (const seat of state.seats) {
    if (seat) {
      seat.bet = 0;
      seat.committed = 0;
      seat.hasActedThisStreet = false;
      seat.ready = false;
    }
  }
  return winners;
}

export function cleanupShowdown(state: LivePokerState) {
  if (state.phase !== "showdown" || !state.showdownSettled) {
    throw new Error("Showdown is not ready to clean up");
  }

  for (const seat of state.seats) {
    if (seat) {
      seat.cards = undefined;
      seat.folded = false;
      seat.isAllIn = false;
      seat.streetAction = undefined;
    }
  }
  state.activeSeatIndex = null;
  state.communityCards = [];
  state.deck = [];
  state.lastWinners = [];
  state.phase = "waiting";
  state.settledAction = null;
  state.showdownPot = null;
  state.showdownSeatIndexes = [];
  state.showdownSettled = false;
}

export function maybeStartNextHand(state: LivePokerState) {
  return (
    state.phase === "waiting" &&
    activeSeats(state).filter((seat) => seat.stack > 0 && seat.ready).length >=
      2
  );
}
