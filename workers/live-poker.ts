/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";
import { jwtVerify } from "jose";
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

declare const WebSocketPair: {
  new (): Record<0 | 1, WebSocket>;
};

interface Env {
  LIVE_POKER_JWT_SECRET?: string;
  LIVE_POKER_TABLE: DurableObjectNamespace<LivePokerTableDurableObject>;
  LIVE_POKER_WEBHOOK_SECRET?: string;
  LIVE_POKER_WEBHOOK_URL?: string;
  NEXTAUTH_SECRET?: string;
}

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
const LIVE_POKER_PATH_REGEX = /^\/live-poker\/([^/]+)$/;
const LIVE_POKER_CLAIM_PATH_REGEX = /^\/live-poker\/([^/]+)\/claim$/;

type LivePokerClaimRequest =
  | {
      amount: number;
      playerId: string;
      playerName: string;
      seatIndex: number;
      type: "INITIAL";
      userId: string;
    }
  | {
      amount: number;
      playerId: string;
      playerName: string;
      type: "ADD_ON";
      userId: string;
    };

function envString(env: Env, key: keyof Env) {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
}

async function verifyToken(env: Env, token: string) {
  const secret =
    envString(env, "LIVE_POKER_JWT_SECRET") ||
    envString(env, "NEXTAUTH_SECRET") ||
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

function send(connection: WebSocket, message: LivePokerServerMessage) {
  if (connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
  }
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

function getTableIdFromPath(pathname: string) {
  const match = pathname.match(LIVE_POKER_PATH_REGEX);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getClaimTableIdFromPath(pathname: string) {
  const match = pathname.match(LIVE_POKER_CLAIM_PATH_REGEX);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const claimTableId = getClaimTableIdFromPath(url.pathname);
    const tableId = claimTableId ?? getTableIdFromPath(url.pathname);
    if (!tableId) {
      return new Response("Not found", { status: 404 });
    }

    if (!claimTableId && request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const id = env.LIVE_POKER_TABLE.idFromName(tableId);
    const object = env.LIVE_POKER_TABLE.get(id);
    return await object.fetch(request);
  },
};

export class LivePokerTableDurableObject extends DurableObject<Env> {
  private readonly bindings: Env;
  private state: LivePokerState | null = null;
  private readonly tableId: string;
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.bindings = env;
    this.tableId = ctx.id.name ?? "";
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<LivePokerState>("state")) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;

    try {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/claim")) {
        return await this.handleClaimRequest(request, url);
      }

      const token = url.searchParams.get("token");
      if (!token) {
        throw new Error("Missing live poker token");
      }

      const auth = await verifyToken(this.bindings, token);
      if (auth.tableId !== this.tableId) {
        throw new Error("Token does not match this table");
      }

      await this.ensureState(url);

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(auth);

      const seat = this.state?.seats.find(
        (candidate) => candidate?.userId === auth.userId
      );
      if (seat) {
        seat.connected = true;
        await this.persist();
      }

      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : "Unauthorized",
        { status: 401 }
      );
    }
  }

  private async handleClaimRequest(request: Request, url: URL) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const webhookSecret = envString(this.bindings, "LIVE_POKER_WEBHOOK_SECRET");
    if (
      !webhookSecret ||
      request.headers.get("x-live-poker-secret") !== webhookSecret
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    await this.ensureState(url);

    try {
      const claim = (await request.json()) as LivePokerClaimRequest;
      this.applyApprovedClaim(claim);
      await this.persist();
      this.broadcast();
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Unable to claim buy-in",
        },
        { status: 409 }
      );
    }
  }

  async webSocketMessage(connection: WebSocket, message: string | ArrayBuffer) {
    await this.ready;

    const auth = connection.deserializeAttachment() as ConnectionState | null;
    if (!auth) {
      connection.close(1008, "Unauthorized");
      return;
    }

    try {
      const rawMessage =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const payload = JSON.parse(rawMessage) as unknown;
      const parsed = clientMessageSchema.safeParse(payload);
      if (!parsed.success) {
        send(connection, {
          type: "actionRejected",
          message: "Invalid table action",
        });
        return;
      }

      await this.handleMessage(auth, parsed.data);
      await this.persist();
      this.broadcast();
    } catch (error) {
      send(connection, {
        type: "actionRejected",
        message: error instanceof Error ? error.message : "Action rejected",
      });
    }
  }

  async webSocketClose(connection: WebSocket, code: number, reason: string) {
    await this.ready;
    const auth = connection.deserializeAttachment() as ConnectionState | null;
    const seat = this.state?.seats.find(
      (candidate) => candidate?.userId === auth?.userId
    );
    if (seat) {
      seat.connected = false;
      await this.persist();
      this.broadcast();
    }
    connection.close(code, reason);
  }

  async webSocketError(connection: WebSocket) {
    await this.webSocketClose(connection, 1011, "WebSocket error");
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

    if (message.type === "kickSeat") {
      if (auth.userId !== this.state.hostUserId) {
        throw new Error("Only the table creator can kick seats");
      }
      if (this.state.phase !== "waiting") {
        throw new Error("Seats can only be kicked between hands");
      }
      const kickedSeat = this.state.seats[message.seatIndex];
      if (!kickedSeat) {
        throw new Error("Seat is already open");
      }
      this.state.seats[message.seatIndex] = null;
      this.state.actionLog.push(
        `${kickedSeat.name} was removed from seat ${message.seatIndex + 1}`
      );
      return;
    }

    if (message.type === "sit") {
      throw new Error("Request and claim an approved buy-in before sitting");
    }

    if (!seat) {
      throw new Error("Take a seat before acting");
    }

    if (this.handleSeatedControlMessage(seat, message)) {
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
    seat: LivePokerSeat,
    message: LivePokerClientMessage
  ) {
    if (!this.state) {
      throw new Error("Table is not ready");
    }

    if (message.type === "addChips") {
      throw new Error(
        "Request and claim an approved add-on before adding chips"
      );
    }

    if (message.type === "leaveSeat") {
      if (this.state.phase !== "waiting") {
        throw new Error("You can leave after the current hand");
      }
      this.state.seats[seat.seatIndex] = null;
      return true;
    }

    if (message.type === "ready") {
      if (this.state.phase !== "waiting") {
        throw new Error("You can ready up between hands");
      }
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

  private applyApprovedClaim(claim: LivePokerClaimRequest) {
    if (!this.state) {
      throw new Error("Table is not ready");
    }
    if (this.state.phase !== "waiting") {
      throw new Error("Approved buy-ins can be claimed between hands");
    }

    if (claim.type === "INITIAL") {
      seatPlayer(this.state, claim.seatIndex, {
        buyIn: claim.amount,
        name: claim.playerName,
        playerId: claim.playerId,
        userId: claim.userId,
      });
      return;
    }

    addChips(this.state, claim.userId, claim.amount);
  }

  private async recordHand(
    pot: number,
    winners: LivePokerWinner[],
    communityCards: string[]
  ) {
    const webhookUrl = envString(this.bindings, "LIVE_POKER_WEBHOOK_URL");
    const webhookSecret = envString(this.bindings, "LIVE_POKER_WEBHOOK_SECRET");
    if (!(webhookUrl && webhookSecret && this.state)) {
      return;
    }

    await fetch(webhookUrl, {
      body: JSON.stringify({
        actionLog: this.state.actionLog.slice(-80),
        bigBlind: this.state.bigBlind,
        communityCards,
        dealerSeat: this.state.dealerSeatIndex ?? 0,
        handNumber: this.state.handNumber,
        pot,
        smallBlind: this.state.smallBlind,
        tableId: this.tableId,
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
      await this.ctx.storage.put("state", this.state);
    }
  }

  private broadcast() {
    if (!this.state) {
      return;
    }

    for (const connection of this.ctx.getWebSockets()) {
      const auth = connection.deserializeAttachment() as ConnectionState | null;
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
    const rawMessage = JSON.stringify(message);
    for (const connection of this.ctx.getWebSockets()) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(rawMessage);
      }
    }
  }
}
