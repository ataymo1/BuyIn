import { jwtVerify } from "jose";
import type * as Party from "partykit/server";
import {
  addChips,
  applyAction,
  createInitialState,
  seatPlayer,
  settleShowdown,
  startHand,
} from "../src/lib/live-poker/engine";
import {
  calculatePot,
  clientMessageSchema,
  type LivePokerAuthToken,
  type LivePokerClientMessage,
  type LivePokerSeat,
  type LivePokerServerMessage,
  type LivePokerState,
  type LivePokerWinner,
  toPublicState,
} from "../src/lib/live-poker/types";

type ConnectionState = LivePokerAuthToken;
type LivePokerActionMessage = Extract<
  LivePokerClientMessage,
  | { type: "allIn" }
  | { type: "bet" }
  | { type: "call" }
  | { type: "check" }
  | { type: "fold" }
  | { type: "raise" }
>;

const encoder = new TextEncoder();

function envString(room: Party.Room, key: string) {
  const value = room.env[key];
  return typeof value === "string" ? value : undefined;
}

async function verifyToken(room: Party.Room, token: string) {
  const secret =
    envString(room, "LIVE_POKER_JWT_SECRET") ||
    envString(room, "NEXTAUTH_SECRET") ||
    "development-live-poker-secret";
  const { payload } = await jwtVerify(token, encoder.encode(secret));
  return {
    exp: Number(payload.exp),
    tableId: String(payload.tableId),
    playerId: String(payload.playerId),
    playerName: String(payload.playerName),
    userId: String(payload.userId),
  } satisfies LivePokerAuthToken;
}

function send(connection: Party.Connection, message: LivePokerServerMessage) {
  connection.send(JSON.stringify(message));
}

function isActionMessage(
  message: LivePokerClientMessage
): message is LivePokerActionMessage {
  return (
    message.type === "allIn" ||
    message.type === "bet" ||
    message.type === "call" ||
    message.type === "check" ||
    message.type === "fold" ||
    message.type === "raise"
  );
}

export default class LivePokerServer implements Party.Server {
  readonly room: Party.Room;
  state: LivePokerState | null = null;

  constructor(room: Party.Room) {
    this.room = room;
  }

  async onStart() {
    this.state = (await this.room.storage.get<LivePokerState>("state")) ?? null;
  }

  async onConnect(
    connection: Party.Connection<ConnectionState>,
    ctx: Party.ConnectionContext
  ) {
    try {
      const url = new URL(ctx.request.url);
      const token = url.searchParams.get("token");
      if (!token) {
        throw new Error("Missing live poker token");
      }

      const auth = await verifyToken(this.room, token);
      if (auth.tableId !== this.room.id) {
        throw new Error("Token does not match this table");
      }

      connection.setState(auth);
      await this.ensureState(url);

      const seat = this.state?.seats.find(
        (candidate) => candidate?.userId === auth.userId
      );
      if (seat) {
        seat.connected = true;
        await this.persist();
      }

      this.broadcast();
    } catch (error) {
      connection.close(
        1008,
        error instanceof Error ? error.message : "Unauthorized"
      );
    }
  }

  async onMessage(message: string, sender: Party.Connection<ConnectionState>) {
    const auth = sender.state;
    if (!auth) {
      sender.close(1008, "Unauthorized");
      return;
    }

    const parsed = clientMessageSchema.safeParse(JSON.parse(message));
    if (!parsed.success) {
      send(sender, { type: "actionRejected", message: "Invalid table action" });
      return;
    }

    try {
      await this.handleMessage(auth, parsed.data);
      await this.persist();
      this.broadcast();
    } catch (error) {
      send(sender, {
        type: "actionRejected",
        message: error instanceof Error ? error.message : "Action rejected",
      });
    }
  }

  async onClose(connection: Party.Connection<ConnectionState>) {
    const auth = connection.state;
    const seat = this.state?.seats.find(
      (candidate) => candidate?.userId === auth?.userId
    );
    if (seat) {
      seat.connected = false;
      await this.persist();
      this.broadcast();
    }
  }

  private async ensureState(url: URL) {
    const hostUserId = url.searchParams.get("hostUserId") ?? "";

    if (this.state) {
      if (!this.state.hostUserId && hostUserId) {
        this.state.hostUserId = hostUserId;
      }
      return;
    }

    this.state = createInitialState({
      bigBlind: Number(url.searchParams.get("bigBlind") ?? 2),
      hostUserId,
      maxBuyIn: Number(url.searchParams.get("maxBuyIn") ?? 400),
      minBuyIn: Number(url.searchParams.get("minBuyIn") ?? 20),
      seatCount: Number(url.searchParams.get("seatCount") ?? 6),
      smallBlind: Number(url.searchParams.get("smallBlind") ?? 1),
    });
    await this.persist();
  }

  private async handleMessage(
    auth: LivePokerAuthToken,
    message: LivePokerClientMessage
  ) {
    if (!this.state) {
      throw new Error("Table is not ready");
    }

    const seat = this.state.seats.find(
      (candidate) => candidate?.userId === auth.userId
    );

    if (message.type === "joinTable" || message.type === "requestSync") {
      return;
    }

    if (message.type === "startHand") {
      if (auth.userId !== this.state.hostUserId) {
        throw new Error("Only the table creator can start the hand");
      }
      if (this.state.phase !== "waiting") {
        throw new Error("A hand is already in progress");
      }
      startHand(this.state);
      this.broadcastMessage({
        type: "handStarted",
        handNumber: this.state.handNumber,
      });
      return;
    }

    if (message.type === "sit") {
      seatPlayer(this.state, message.seatIndex, {
        buyIn: message.buyIn,
        name: auth.playerName,
        playerId: auth.playerId,
        userId: auth.userId,
      });
      return;
    }

    if (!seat) {
      throw new Error("Take a seat before acting");
    }

    if (this.handleSeatedControlMessage(auth, seat, message)) {
      return;
    }

    if (!isActionMessage(message)) {
      throw new Error("Invalid table action");
    }

    applyAction(this.state, auth.userId, message);
    if (this.state.phase === "showdown") {
      const pot = calculatePot(this.state);
      const winners = settleShowdown(this.state);
      const communityCards = [...this.state.communityCards];
      this.state.actionLog.push(
        `Hand ${this.state.handNumber} ended: ${winners
          .map((winner) => `${winner.amount} to seat ${winner.seatIndex + 1}`)
          .join(", ")}`
      );
      await this.recordHand(pot, winners, communityCards);
    }
  }

  private handleSeatedControlMessage(
    auth: LivePokerAuthToken,
    seat: LivePokerSeat,
    message: LivePokerClientMessage
  ) {
    if (!this.state) {
      throw new Error("Table is not ready");
    }

    if (message.type === "addChips") {
      addChips(this.state, auth.userId, message.amount);
      return true;
    }

    if (message.type === "leaveSeat") {
      if (this.state.phase !== "waiting") {
        throw new Error("You can leave after the current hand");
      }
      this.state.seats[seat.seatIndex] = null;
      return true;
    }

    if (message.type === "ready") {
      if (message.ready && seat.sitOut) {
        throw new Error("Return before readying for the next hand");
      }
      if (message.ready && seat.stack <= 0) {
        throw new Error("Add chips before readying for the next hand");
      }
      seat.ready = message.ready;
      this.state.actionLog.push(
        `${seat.name} is ${message.ready ? "ready" : "not ready"}`
      );
      return true;
    }

    if (message.type === "sitOut") {
      seat.sitOut = message.sitOut;
      seat.ready = false;
      return true;
    }

    return false;
  }

  private async recordHand(
    pot: number,
    winners: LivePokerWinner[],
    communityCards: string[]
  ) {
    const webhookUrl = envString(this.room, "LIVE_POKER_WEBHOOK_URL");
    const webhookSecret = envString(this.room, "LIVE_POKER_WEBHOOK_SECRET");
    if (!(webhookUrl && webhookSecret && this.state)) {
      return;
    }

    await fetch(webhookUrl, {
      body: JSON.stringify({
        actionLog: this.state.actionLog.slice(-80),
        bigBlind: this.state.bigBlind,
        communityCards,
        dealerSeat: this.state.dealerSeatIndex ?? 0,
        tableId: this.room.id,
        handNumber: this.state.handNumber,
        pot,
        smallBlind: this.state.smallBlind,
        winners,
      }),
      headers: {
        "content-type": "application/json",
        "x-live-poker-secret": webhookSecret,
      },
      method: "POST",
    }).catch(() => undefined);
  }

  private async persist() {
    if (this.state) {
      await this.room.storage.put("state", this.state);
    }
  }

  private broadcast() {
    if (!this.state) {
      return;
    }

    for (const connection of this.room.getConnections<ConnectionState>()) {
      const auth = connection.state;
      if (!auth) {
        continue;
      }
      send(connection, {
        type: "tableState",
        state: toPublicState(this.state, auth.userId),
      });
      const seat = this.state.seats.find(
        (candidate) => candidate?.userId === auth.userId
      );
      if (seat?.cards?.length) {
        send(connection, { type: "privateCards", cards: seat.cards });
      }
    }
  }

  private broadcastMessage(message: LivePokerServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }
}
