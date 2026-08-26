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

const REQUIRED_LEDGER_HEADERS = [
  "player_nickname",
  "player_id",
  "session_start_at",
  "session_end_at",
  "buy_in",
  "buy_out",
  "stack",
  "net",
] as const;
const BOM = /^\uFEFF/;
const LEDGER_FILE_NAME = /(?:^|[/\\])ledger_(.+?)(?: \(\d+\))?\.csv$/i;

type LedgerHeader = (typeof REQUIRED_LEDGER_HEADERS)[number] | "nit_escrow";

interface LedgerEntry {
  sourceId: string;
  name: string;
  buyIn: number;
  cashOut: number;
  sessionStart: number;
  sessionEnd?: number;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CSV quoting requires a small state machine.
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

  if (quoted) {
    throw new Error("The PokerNow ledger contains an unterminated CSV value.");
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function parseNumber(value: string, column: string, rowNumber: number) {
  if (!value.trim()) {
    throw new Error(`PokerNow ledger row ${rowNumber} is missing ${column}.`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(
      `PokerNow ledger row ${rowNumber} has an invalid ${column}.`
    );
  }
  return amount;
}

function parseOptionalNumber(value: string, column: string, rowNumber: number) {
  return value.trim() ? parseNumber(value, column, rowNumber) : undefined;
}

function parseTimestamp(value: string, column: string, rowNumber: number) {
  const timestamp = Date.parse(value);
  if (!(value.trim() && Number.isFinite(timestamp))) {
    throw new Error(
      `PokerNow ledger row ${rowNumber} has an invalid ${column}.`
    );
  }
  return timestamp;
}

function getColumn(
  row: string[],
  indexes: Map<string, number>,
  header: LedgerHeader
) {
  return row[indexes.get(header) ?? -1] ?? "";
}

function parseLedgerEntry(
  row: string[],
  indexes: Map<string, number>,
  rowNumber: number
): LedgerEntry {
  const value = (header: LedgerHeader) => getColumn(row, indexes, header);
  const name = value("player_nickname").trim();
  const sourceId = value("player_id").trim();
  if (!name || name.length > 80) {
    throw new Error(
      `PokerNow ledger row ${rowNumber} has an invalid player nickname.`
    );
  }
  if (!sourceId) {
    throw new Error(`PokerNow ledger row ${rowNumber} is missing a player ID.`);
  }

  const sessionStart = parseTimestamp(
    value("session_start_at"),
    "session start",
    rowNumber
  );
  const sessionEndValue = value("session_end_at");
  const sessionEnd = sessionEndValue.trim()
    ? parseTimestamp(sessionEndValue, "session end", rowNumber)
    : undefined;
  if (sessionEnd !== undefined && sessionEnd < sessionStart) {
    throw new Error(`PokerNow ledger row ${rowNumber} ends before it starts.`);
  }

  const buyIn = parseNumber(value("buy_in"), "buy-in", rowNumber);
  const buyOut = parseOptionalNumber(value("buy_out"), "buy-out", rowNumber);
  const stack = parseNumber(value("stack"), "stack", rowNumber);
  const nitEscrowValue = value("nit_escrow");
  const nitEscrow = nitEscrowValue.trim()
    ? parseNumber(nitEscrowValue, "nit escrow", rowNumber)
    : 0;
  const net = parseNumber(value("net"), "net", rowNumber);
  if (
    buyIn < 0 ||
    (buyOut !== undefined && buyOut < 0) ||
    stack < 0 ||
    nitEscrow < 0
  ) {
    throw new Error(
      `PokerNow ledger row ${rowNumber} contains a negative chip amount.`
    );
  }

  const cashOut = roundMoney((buyOut ?? stack) + nitEscrow);
  if (Math.abs(roundMoney(cashOut - buyIn) - net) > 0.01) {
    throw new Error(
      `PokerNow ledger row ${rowNumber} has totals that do not balance.`
    );
  }

  return { sourceId, name, buyIn, cashOut, sessionStart, sessionEnd };
}

function getLedgerRows(text: string) {
  const [headerRow, ...rows] = parseCsv(text.replace(BOM, ""));
  const indexes = new Map(
    headerRow?.map(
      (header, index) => [header.trim().toLowerCase(), index] as const
    ) ?? []
  );
  const missingHeaders = REQUIRED_LEDGER_HEADERS.filter(
    (header) => !indexes.has(header)
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `This does not look like a PokerNow ledger CSV (missing ${missingHeaders.join(
        ", "
      )}).`
    );
  }
  if (rows.length === 0) {
    throw new Error("The PokerNow ledger is empty.");
  }
  return { indexes, rows };
}

function sourceIdFromFileName(fileName: string) {
  const ledgerId = fileName.match(LEDGER_FILE_NAME)?.[1];
  return ledgerId?.trim() || fileName.trim();
}

export function parsePokerNowLedger(
  text: string,
  fileName = "poker-now-ledger.csv"
): PokerNowSession {
  const { indexes, rows } = getLedgerRows(text);
  const entries = rows.map((row, index) =>
    parseLedgerEntry(row, indexes, index + 2)
  );
  const players = new Map<
    string,
    PokerNowPlayer & { latestSessionStart: number }
  >();

  for (const entry of entries) {
    const player = players.get(entry.sourceId);
    if (!player) {
      players.set(entry.sourceId, {
        sourceId: entry.sourceId,
        name: entry.name,
        buyIn: roundMoney(entry.buyIn),
        cashOut: entry.cashOut,
        latestSessionStart: entry.sessionStart,
      });
      continue;
    }

    player.buyIn = roundMoney(player.buyIn + entry.buyIn);
    player.cashOut = roundMoney(player.cashOut + entry.cashOut);
    if (entry.sessionStart > player.latestSessionStart) {
      player.name = entry.name;
      player.latestSessionStart = entry.sessionStart;
    }
  }

  const startedAt = Math.min(...entries.map((entry) => entry.sessionStart));
  const endedAt = Math.max(
    ...entries.map((entry) => entry.sessionEnd ?? entry.sessionStart)
  );

  return {
    sourceId: sourceIdFromFileName(fileName),
    startedAt,
    endedAt,
    handCount: 0,
    players: [...players.values()].map(
      ({ latestSessionStart: _latestSessionStart, ...player }) => player
    ),
  };
}
