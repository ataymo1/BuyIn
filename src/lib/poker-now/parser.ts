// biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: PokerNow CSV parsing is a linear state machine.
// biome-ignore-all lint/performance/useTopLevelRegex: Dynamic expressions include the PokerNow player identity pattern.
export interface PokerNowPlayer {
  sourceId: string;
  name: string;
  buyIn: number;
  cashOut: number;
}

export interface PokerNowSession {
  sourceId: string;
  startedAt: number;
  endedAt: number;
  smallBlind?: number;
  bigBlind?: number;
  handCount: number;
  players: PokerNowPlayer[];
}

interface CsvRow {
  entry: string;
  at: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function parsePokerNowLog(
  text: string,
  fileName = "poker-now.csv"
): PokerNowSession {
  const csv = parseCsv(text.replace(/^\uFEFF/, ""));
  const headers = csv.shift()?.map((header) => header.trim().toLowerCase());
  const entryIndex = headers?.indexOf("entry") ?? -1;
  const atIndex = headers?.indexOf("at") ?? -1;
  if (entryIndex < 0 || atIndex < 0) {
    throw new Error(
      "This does not look like a PokerNow CSV log (entry and at columns are required)."
    );
  }

  const rows: CsvRow[] = csv
    .map((columns) => ({
      entry: columns[entryIndex] ?? "",
      at: columns[atIndex] ?? "",
    }))
    .filter((row) => row.entry && Number.isFinite(Date.parse(row.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (rows.length === 0) {
    throw new Error("The PokerNow log is empty.");
  }

  const players = new Map<string, PokerNowPlayer>();
  const remember = (name: string, sourceId: string) => {
    const existing = players.get(sourceId);
    if (existing) {
      return existing;
    }
    const player = { sourceId, name: name.trim(), buyIn: 0, cashOut: 0 };
    players.set(sourceId, player);
    return player;
  };
  const identity = String.raw`"([^"@]+?)\s*@\s*([^"\s]+)"`;
  const approval = new RegExp(
    String.raw`approved the player ${identity} participation with a stack of (\d+(?:\.\d+)?)`,
    "i"
  );
  const stackEvent =
    /(?:quits the game with a stack of|stand up with the stack of) (\d+(?:\.\d+)?)/i;
  const stackAddition = new RegExp(
    String.raw`queued the stack change for the player ${identity} adding (\d+(?:\.\d+)?) chips`,
    "i"
  );
  const quotedIdentity = new RegExp(identity, "g");
  let smallBlind: number | undefined;
  let bigBlind: number | undefined;
  const hands = new Set<string>();

  for (const row of rows) {
    const approved = row.entry.match(approval);
    if (approved) {
      remember(approved[1], approved[2]).buyIn += Number(approved[3]);
    }
    const addition = row.entry.match(stackAddition);
    if (addition) {
      remember(addition[1], addition[2]).buyIn += Number(addition[3]);
    }

    quotedIdentity.lastIndex = 0;
    for (const match of row.entry.matchAll(quotedIdentity)) {
      remember(match[1], match[2]);
    }

    const stack = row.entry.match(stackEvent);
    if (stack) {
      const who = row.entry.match(new RegExp(identity));
      if (who) {
        remember(who[1], who[2]).cashOut = Number(stack[1]);
      }
    }

    if (row.entry.startsWith("Player stacks:")) {
      const playerStack = new RegExp(
        String.raw`${identity} \((\d+(?:\.\d+)?)\)`,
        "g"
      );
      for (const match of row.entry.matchAll(playerStack)) {
        remember(match[1], match[2]).cashOut = Number(match[3]);
      }
    }

    const hand = row.entry.match(/-- starting hand #(\d+)/i);
    if (hand) {
      hands.add(hand[1]);
    }
    const blind = row.entry.match(/posts a (small|big) blind of ([\d.]+)/i);
    if (blind?.[1].toLowerCase() === "small") {
      smallBlind ??= Number(blind[2]);
    }
    if (blind?.[1].toLowerCase() === "big") {
      bigBlind ??= Number(blind[2]);
    }
  }

  const participants = [...players.values()]
    .filter((player) => player.buyIn > 0)
    .map((player) => ({
      ...player,
      buyIn: roundMoney(player.buyIn),
      cashOut: roundMoney(player.cashOut),
    }));
  if (participants.length === 0) {
    throw new Error("No PokerNow player buy-ins were found in this log.");
  }

  const sourceId =
    fileName.match(/poker_now_log_([^.]+)\.csv$/i)?.[1] ?? fileName;
  return {
    sourceId,
    startedAt: Date.parse(rows[0].at),
    endedAt: Date.parse(rows.at(-1)?.at ?? rows[0].at),
    smallBlind,
    bigBlind,
    handCount: hands.size,
    players: participants,
  };
}
