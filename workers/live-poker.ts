/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";
import { jwtVerify } from "jose";
import {
  addChips,
  applyAction,
  cleanupShowdown,
  createInitialState,
  revealNextRunoutStage,
  seatPlayer,
  settleShowdown,
} from "../src/lib/live-poker/engine";
import {
  reconcileNextHandTransition,
  startAutomaticHand,
} from "../src/lib/live-poker/lifecycle";
import {
  assertLivePokerActionAvailable,
  clearLivePokerTiming,
  consumeLivePokerTimeBank,
  DEFAULT_LIVE_POKER_TIMING,
  getDueLivePokerTimingEvent,
  getLivePokerSeatTimeBankRemainingMs,
  getLivePokerTimeoutAction,
  getNextLivePokerDeadline,
  type LivePokerTimingConfig,
  repairLivePokerTimeBanks,
  startLivePokerTimeBank,
  startLivePokerTransition,
  startLivePokerTurn,
} from "../src/lib/live-poker/timing";
import {
  calculatePot,
  clientMessageSchema,
  type LivePokerAuthToken,
  type LivePokerClientMessage,
  type LivePokerSeat,
  type LivePokerServerMessage,
  type LivePokerState,
  type LivePokerTableConfig,
  type LivePokerWinner,
  toPublicState,
} from "../src/lib/live-poker/types";

declare const WebSocketPair: {
  new (): Record<0 | 1, WebSocket>;
};

interface Env {
  LIVE_POKER_JWT_SECRET?: string;
  LIVE_POKER_SETTLEMENT_URL?: string;
  LIVE_POKER_TABLE: DurableObjectNamespace<LivePokerTableDurableObject>;
  LIVE_POKER_TURN_TIMEOUT_SECONDS?: string;
  LIVE_POKER_WEBHOOK_SECRET?: string;
  LIVE_POKER_WEBHOOK_URL?: string;
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

interface LivePokerClaimRequest {
  amount: number;
  config: LivePokerTableConfig;
  playerId: string;
  playerName: string;
  requestId: string;
  seatIndex?: number;
  type: "ADD_ON" | "INITIAL";
  userId: string;
}

interface OutboxDelivery {
  attempts: number;
  id: string;
  kind: "hand" | "settlement";
  nextAttemptAt: number;
  payload: unknown;
}

const encoder = new TextEncoder();
const LIVE_POKER_PATH_REGEX = /^\/live-poker\/([^/]+)$/;
const LIVE_POKER_CLAIM_PATH_REGEX = /^\/live-poker\/([^/]+)\/claim$/;
const LIVE_POKER_CLOSE_PATH_REGEX = /^\/live-poker\/([^/]+)\/close$/;
const MAX_OUTBOX_DELIVERIES_PER_RUN = 10;

function envString(env: Env, key: keyof Env) {
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireEnvString(env: Env, key: keyof Env) {
  const value = envString(env, key);
  if (!value) {
    throw new Error(`${String(key)} is not configured`);
  }
  return value;
}

function validateTableConfig(config: LivePokerTableConfig) {
  const values = [
    config.bigBlind,
    config.maxBuyIn,
    config.minBuyIn,
    config.seatCount,
    config.smallBlind,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Invalid live poker table configuration");
  }
  if (
    !config.hostUserId ||
    config.smallBlind <= 0 ||
    config.bigBlind < config.smallBlind ||
    config.minBuyIn < 0 ||
    config.maxBuyIn < config.minBuyIn ||
    !Number.isInteger(config.seatCount) ||
    config.seatCount < 2 ||
    config.seatCount > 9
  ) {
    throw new Error("Invalid live poker table configuration");
  }
  return config;
}

async function verifyToken(env: Env, token: string) {
  const secret = requireEnvString(env, "LIVE_POKER_JWT_SECRET");
  const { payload } = await jwtVerify(token, encoder.encode(secret));
  const tableConfig = validateTableConfig(
    payload.tableConfig as LivePokerTableConfig
  );
  const auth = {
    exp: Number(payload.exp),
    tableConfig,
    tableId: String(payload.tableId),
    playerId: String(payload.playerId),
    playerName: String(payload.playerName),
    userId: String(payload.userId),
  } satisfies LivePokerAuthToken;
  if (!(auth.tableId && auth.playerId && auth.playerName && auth.userId)) {
    throw new Error("Invalid live poker token");
  }
  return auth;
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

function getPathTableId(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const tableId =
      getPathTableId(url.pathname, LIVE_POKER_CLAIM_PATH_REGEX) ??
      getPathTableId(url.pathname, LIVE_POKER_CLOSE_PATH_REGEX) ??
      getPathTableId(url.pathname, LIVE_POKER_PATH_REGEX);
    if (!tableId) {
      return new Response("Not found", { status: 404 });
    }

    const isSocketPath = LIVE_POKER_PATH_REGEX.test(url.pathname);
    if (isSocketPath && request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const id = env.LIVE_POKER_TABLE.idFromName(tableId);
    return await env.LIVE_POKER_TABLE.get(id).fetch(request);
  },
};

export class LivePokerTableDurableObject extends DurableObject<Env> {
  private readonly bindings: Env;
  private flushingOutbox: Promise<void> | null = null;
  private outbox: OutboxDelivery[] = [];
  private state: LivePokerState | null = null;
  private readonly tableId: string;
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.bindings = env;
    this.tableId = ctx.id.name ?? "";
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get(["state", "outbox"]);
      this.state = (stored.get("state") as LivePokerState | undefined) ?? null;
      this.outbox =
        (stored.get("outbox") as OutboxDelivery[] | undefined) ?? [];
      if (this.repairTimingState(Date.now())) {
        await this.persist();
      } else {
        await this.scheduleAlarm();
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);

    try {
      if (LIVE_POKER_CLAIM_PATH_REGEX.test(url.pathname)) {
        return await this.handleClaimRequest(request);
      }
      if (LIVE_POKER_CLOSE_PATH_REGEX.test(url.pathname)) {
        return await this.handleCloseRequest(request);
      }

      const token = url.searchParams.get("token");
      if (!token) {
        throw new Error("Missing live poker token");
      }

      const auth = await verifyToken(this.bindings, token);
      if (auth.tableId !== this.tableId) {
        throw new Error("Token does not match this table");
      }

      await this.ensureState(auth.tableConfig);
      const now = Date.now();
      const repairedTiming = this.repairTimingState(now);
      const advancedTiming = this.advanceDueTiming(now);
      if (repairedTiming || advancedTiming) {
        await this.persist();
      }
      if (this.state?.admissionsClosed) {
        return new Response("Table is closed", { status: 410 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(auth);

      const seat = this.findSeatByUserId(auth.userId);
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

  async alarm() {
    await this.ready;
    const now = Date.now();
    const repairedTiming = this.repairTimingState(now);
    const advancedTiming = this.advanceDueTiming(now);
    if (repairedTiming || advancedTiming) {
      await this.persist();
      this.broadcast();
    }
    await this.flushOutbox();
    await this.scheduleAlarm();
  }

  async webSocketMessage(connection: WebSocket, message: string | ArrayBuffer) {
    await this.ready;

    const auth = connection.deserializeAttachment() as ConnectionState | null;
    if (!auth || this.state?.admissionsClosed) {
      connection.close(1008, "Unauthorized");
      return;
    }

    try {
      const rawMessage =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const parsed = clientMessageSchema.safeParse(
        JSON.parse(rawMessage) as unknown
      );
      if (!parsed.success) {
        send(connection, {
          type: "actionRejected",
          message: "Invalid table action",
        });
        return;
      }

      const now = Date.now();
      const repairedTiming = this.repairTimingState(now);
      const advancedTiming = this.advanceDueTiming(now);
      if (repairedTiming || advancedTiming) {
        await this.persist();
        this.broadcast();
      }
      this.handleMessage(auth, parsed.data, now);
      this.reconcileNextHand(now);
      await this.persist();
      this.broadcast();
      this.ctx.waitUntil(this.flushOutbox());
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
    const seat = this.findSeatByUserId(auth?.userId);
    if (seat && !this.hasOpenConnection(auth?.userId, connection)) {
      seat.connected = false;
      await this.persist();
      this.broadcast();
    }
    connection.close(code, reason);
  }

  async webSocketError(connection: WebSocket) {
    await this.webSocketClose(connection, 1011, "WebSocket error");
  }

  private async handleClaimRequest(request: Request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!this.hasWorkerSecret(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const claim = (await request.json()) as LivePokerClaimRequest;
      if (!claim.requestId) {
        throw new Error("A requestId is required");
      }
      await this.ensureState(validateTableConfig(claim.config));
      if (this.state?.admissionsClosed) {
        throw new Error("Table is closed");
      }
      if (this.state?.appliedRequestIds?.includes(claim.requestId)) {
        return Response.json({ idempotent: true, ok: true });
      }

      this.applyApprovedClaim(claim);
      if (this.state) {
        this.reconcileNextHand(Date.now());
        this.state.appliedRequestIds = [
          ...(this.state.appliedRequestIds ?? []),
          claim.requestId,
        ];
      }
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

  private async handleCloseRequest(request: Request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!this.hasWorkerSecret(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = (await request.json()) as { config: LivePokerTableConfig };
      await this.ensureState(validateTableConfig(body.config), true);
      if (!this.state) {
        throw new Error("Table is not ready");
      }

      this.state.admissionsClosed = true;
      this.completeCurrentHand();
      for (const seat of this.state.seats) {
        if (seat) {
          this.queueSettlement(seat);
        }
      }
      this.state.seats = this.state.seats.map(() => null);
      clearLivePokerTiming(this.state);
      await this.persist();

      for (const connection of this.ctx.getWebSockets()) {
        send(connection, {
          message: "Table closed by host",
          type: "actionRejected",
        });
        connection.close(1001, "Table closed");
      }
      await this.flushOutbox();
      return Response.json({ ok: true, pendingDeliveries: this.outbox.length });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Unable to close" },
        { status: 409 }
      );
    }
  }

  private hasWorkerSecret(request: Request) {
    const expected = envString(this.bindings, "LIVE_POKER_WEBHOOK_SECRET");
    return Boolean(
      expected && request.headers.get("x-live-poker-secret") === expected
    );
  }

  private async ensureState(
    config: LivePokerTableConfig,
    allowConfigMismatchForClosure = false
  ) {
    validateTableConfig(config);
    if (!this.state) {
      this.state = createInitialState(config);
      this.state.admissionsClosed = false;
      this.state.appliedRequestIds = [];
      this.state.turnDeadlineAt = null;
      await this.persist();
      return;
    }

    // Signed tokens and secret-authenticated server requests are authoritative.
    // This also upgrades legacy seats to persisted per-session time banks.
    let repaired = repairLivePokerTimeBanks(this.state, this.timing());
    if (this.state.hostUserId !== config.hostUserId) {
      this.state.hostUserId = config.hostUserId;
      repaired = true;
    }

    const configMismatch =
      this.state.bigBlind !== config.bigBlind ||
      this.state.maxBuyIn !== config.maxBuyIn ||
      this.state.minBuyIn !== config.minBuyIn ||
      this.state.seatCount !== config.seatCount ||
      this.state.smallBlind !== config.smallBlind;
    if (configMismatch) {
      if (allowConfigMismatchForClosure) {
        await this.persist();
        return;
      }
      if (
        this.state.phase === "waiting" &&
        this.state.seats.every((seat) => seat === null)
      ) {
        this.state = createInitialState(config);
        this.state.admissionsClosed = false;
        this.state.appliedRequestIds = [];
        this.state.turnDeadlineAt = null;
        await this.persist();
        return;
      }
      throw new Error("Signed table configuration does not match stored table");
    }

    if (repaired) {
      await this.persist();
    }
  }

  private handleMessage(
    auth: LivePokerAuthToken,
    message: LivePokerClientMessage,
    now: number
  ) {
    if (!this.state) {
      throw new Error("Table is not ready");
    }

    const seat = this.findSeatByUserId(auth.userId);
    if (message.type === "joinTable" || message.type === "requestSync") {
      return;
    }

    if (message.type === "kickSeat") {
      this.requireHost(auth.userId);
      if (this.state.phase !== "waiting") {
        throw new Error("Seats can only be kicked between hands");
      }
      const kickedSeat = this.state.seats[message.seatIndex];
      if (!kickedSeat) {
        throw new Error("Seat is already open");
      }
      this.queueSettlement(kickedSeat);
      this.state.seats[message.seatIndex] = null;
      this.state.actionLog.push(
        `${kickedSeat.name} was removed from seat ${message.seatIndex + 1}`
      );
      this.disconnectUser(kickedSeat.userId, "Removed by host");
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
    assertLivePokerActionAvailable(this.state);

    const actingSeatIndex = this.state.activeSeatIndex;
    applyAction(this.state, auth.userId, message);
    if (actingSeatIndex !== null) {
      consumeLivePokerTimeBank(this.state, actingSeatIndex, now, this.timing());
    }
    this.captureSettledAction(actingSeatIndex, message);
    startLivePokerTransition(
      this.state,
      "actionSettle",
      now + this.timing().actionSettleMs
    );
  }

  private requireHost(userId: string) {
    if (userId !== this.state?.hostUserId) {
      throw new Error("Only the table creator can perform this action");
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
      this.queueSettlement(seat);
      this.state.seats[seat.seatIndex] = null;
      return true;
    }

    if (message.type === "sitOut") {
      seat.sitOut = message.sitOut;
      return true;
    }
    return false;
  }

  private applyApprovedClaim(claim: LivePokerClaimRequest) {
    if (!this.state) {
      throw new Error("Table is not ready");
    }
    if (
      !Number.isFinite(claim.amount) ||
      claim.amount <= 0 ||
      !claim.playerId ||
      !claim.playerName ||
      !claim.userId ||
      !(claim.type === "INITIAL" || claim.type === "ADD_ON")
    ) {
      throw new Error("Invalid approved buy-in payload");
    }
    if (this.state.phase !== "waiting") {
      throw new Error("Approved buy-ins can be claimed between hands");
    }

    if (claim.type === "INITIAL") {
      if (
        claim.seatIndex === undefined ||
        !Number.isInteger(claim.seatIndex) ||
        claim.seatIndex < 0 ||
        claim.seatIndex >= this.state.seatCount
      ) {
        throw new Error("A valid seat is required for an initial buy-in");
      }
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

  private completeShowdown() {
    if (
      !this.state ||
      this.state.phase !== "showdown" ||
      this.state.showdownSettled
    ) {
      return;
    }
    const pot = calculatePot(this.state);
    const communityCards = [...this.state.communityCards];
    const winners = settleShowdown(this.state);
    this.state.actionLog.push(
      `Hand ${this.state.handNumber} ended: ${winners
        .map((winner) => `${winner.amount} to seat ${winner.seatIndex + 1}`)
        .join(", ")}`
    );
    this.queueCompletedHand(pot, winners, communityCards);
  }

  private completeCurrentHand() {
    if (!this.state || this.state.phase === "waiting") {
      return;
    }
    if (this.state.phase !== "showdown") {
      this.state.phase = "showdown";
      this.state.activeSeatIndex = null;
    }
    this.completeShowdown();
    if (this.state.showdownSettled) {
      cleanupShowdown(this.state);
      clearLivePokerTiming(this.state);
    }
  }

  private queueCompletedHand(
    pot: number,
    winners: LivePokerWinner[],
    communityCards: string[]
  ) {
    if (!this.state) {
      return;
    }
    const deliveryId = `${this.tableId}:hand:${this.state.handNumber}`;
    if (this.outbox.some((delivery) => delivery.id === deliveryId)) {
      return;
    }
    this.outbox.push({
      attempts: 0,
      id: deliveryId,
      kind: "hand",
      nextAttemptAt: Date.now(),
      payload: {
        actionLog: this.state.actionLog.slice(-80),
        bigBlind: this.state.bigBlind,
        communityCards,
        completedAt: Date.now(),
        dealerSeat: this.state.dealerSeatIndex ?? 0,
        handNumber: this.state.handNumber,
        pot,
        smallBlind: this.state.smallBlind,
        tableId: this.tableId,
        winners,
      },
    });
  }

  private queueSettlement(seat: LivePokerSeat) {
    this.outbox.push({
      attempts: 0,
      id: `${this.tableId}:settlement:${crypto.randomUUID()}`,
      kind: "settlement",
      nextAttemptAt: Date.now(),
      payload: {
        buyIn: seat.buyIn,
        cashOut: seat.stack,
        playerId: seat.playerId,
        settledAt: Date.now(),
        settlementId: crypto.randomUUID(),
        tableId: this.tableId,
        userId: seat.userId,
      },
    });
  }

  private flushOutbox() {
    if (!this.flushingOutbox) {
      this.flushingOutbox = this.drainOutbox().finally(() => {
        this.flushingOutbox = null;
      });
    }
    return this.flushingOutbox;
  }

  private async drainOutbox() {
    let delivered = 0;
    while (
      this.outbox.length > 0 &&
      delivered < MAX_OUTBOX_DELIVERIES_PER_RUN
    ) {
      const delivery = this.outbox[0];
      if (delivery.nextAttemptAt > Date.now()) {
        break;
      }

      try {
        await this.deliverOutboxItem(delivery);
        this.outbox.shift();
        delivered += 1;
      } catch {
        delivery.attempts += 1;
        delivery.nextAttemptAt =
          Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts);
        await this.persist();
        return;
      }
      await this.persist();
    }
  }

  private async deliverOutboxItem(delivery: OutboxDelivery) {
    const url = requireEnvString(
      this.bindings,
      delivery.kind === "hand"
        ? "LIVE_POKER_WEBHOOK_URL"
        : "LIVE_POKER_SETTLEMENT_URL"
    );
    const secret = requireEnvString(this.bindings, "LIVE_POKER_WEBHOOK_SECRET");
    const response = await fetch(url, {
      body: JSON.stringify(delivery.payload),
      headers: {
        "content-type": "application/json",
        "x-live-poker-secret": secret,
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  private captureSettledAction(
    seatIndex: number | null,
    action: LivePokerActionMessage
  ) {
    if (!this.state || seatIndex === null) {
      return;
    }
    const seat = this.state.seats[seatIndex];
    this.state.settledAction = {
      amount:
        action.type === "bet" || action.type === "raise"
          ? action.amount
          : (seat?.streetAction?.amount ?? 0),
      seatIndex,
      type: action.type,
    };
  }

  private finishShowdown(at: number) {
    if (!this.state) {
      return;
    }
    this.completeShowdown();
    startLivePokerTransition(
      this.state,
      "showdown",
      at + this.timing().showdownMs
    );
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Persisted poker timing events are kept in one chronological transition loop so late alarms catch up atomically.
  private advanceDueTiming(now: number) {
    if (!this.state) {
      return false;
    }

    let changed = false;
    for (let step = 0; step < 20; step += 1) {
      const event = getDueLivePokerTimingEvent(this.state, now);
      if (!event) {
        return changed;
      }
      changed = true;

      if (event.type === "startTimeBank") {
        const seatIndex = this.state.activeSeatIndex;
        const remaining =
          seatIndex === null
            ? 0
            : getLivePokerSeatTimeBankRemainingMs(
                this.state,
                seatIndex,
                this.timing()
              );
        startLivePokerTimeBank(this.state, event.at, this.timing());
        const seat = seatIndex === null ? null : this.state.seats[seatIndex];
        if (seat) {
          this.state.actionLog.push(
            `${seat.name}'s time bank started with ${remaining / 1000} seconds remaining`
          );
        }
        continue;
      }

      if (event.type === "turnExpired") {
        const seatIndex = this.state.activeSeatIndex;
        const seat = seatIndex === null ? null : this.state.seats[seatIndex];
        if (seatIndex === null || !seat) {
          clearLivePokerTiming(this.state);
          continue;
        }
        const action = getLivePokerTimeoutAction(this.state);
        if (!action) {
          clearLivePokerTiming(this.state);
          continue;
        }
        const canCheck = action.type === "check";
        const timeBankWasActive = this.state.timeBankActive ?? false;
        consumeLivePokerTimeBank(
          this.state,
          seatIndex,
          event.at,
          this.timing()
        );
        applyAction(this.state, seat.userId, action);
        this.captureSettledAction(seatIndex, action);
        this.state.actionLog.push(
          `${seat.name} automatically ${canCheck ? "checked" : "folded"} ${
            timeBankWasActive
              ? "after the time bank expired"
              : "with no time bank remaining"
          }`
        );
        startLivePokerTransition(
          this.state,
          "actionSettle",
          event.at + this.timing().actionSettleMs
        );
        continue;
      }

      this.state.transition = null;
      this.state.transitionDeadlineAt = null;
      if (event.transition === "nextHand") {
        if (!startAutomaticHand(this.state, event.at, this.timing())) {
          clearLivePokerTiming(this.state);
          continue;
        }
        this.broadcastMessage({
          type: "handStarted",
          handNumber: this.state.handNumber,
        });
        continue;
      }

      if (event.transition === "showdown") {
        cleanupShowdown(this.state);
        clearLivePokerTiming(this.state);
        this.reconcileNextHand(event.at);
        continue;
      }

      if (event.transition === "runout") {
        revealNextRunoutStage(this.state);
        if (this.state.phase === "showdown") {
          this.finishShowdown(event.at);
        } else {
          startLivePokerTransition(
            this.state,
            "runout",
            event.at + this.timing().runoutStageMs
          );
        }
        continue;
      }

      if (event.transition === "actionSettle") {
        this.state.settledAction = null;
      }
      if (this.state.phase === "showdown") {
        this.finishShowdown(event.at);
      } else if (this.state.runoutPending) {
        startLivePokerTransition(
          this.state,
          "runout",
          event.at + this.timing().runoutStageMs
        );
      } else if (this.state.activeSeatIndex !== null) {
        startLivePokerTurn(this.state, event.at, this.timing());
      } else {
        clearLivePokerTiming(this.state);
      }
    }

    throw new Error("Live poker timing did not converge");
  }

  private repairTimingState(now: number) {
    if (!this.state) {
      return false;
    }

    const timing = this.timing();
    let changed = repairLivePokerTimeBanks(this.state, timing);
    if (this.state.phase === "waiting") {
      const hasValidNextHand =
        this.state.transition === "nextHand" &&
        Number.isFinite(this.state.transitionDeadlineAt);
      if (
        (!hasValidNextHand &&
          Boolean(
            this.state.transition || this.state.transitionDeadlineAt !== null
          )) ||
        Boolean(
          this.state.turnDeadlineAt ||
            this.state.turnStartedAt ||
            this.state.timeBankActive
        )
      ) {
        clearLivePokerTiming(this.state);
        changed = true;
      }
      return this.reconcileNextHand(now) || changed;
    }
    if (this.state.transition) {
      return changed;
    }
    if (this.state.phase === "showdown") {
      this.finishShowdown(now);
      return true;
    }
    if (this.state.runoutPending) {
      startLivePokerTransition(
        this.state,
        "runout",
        now + timing.runoutStageMs
      );
      return true;
    }
    if (this.state.activeSeatIndex !== null && !this.state.turnDeadlineAt) {
      startLivePokerTurn(this.state, now, timing);
      return true;
    }
    return changed;
  }

  private reconcileNextHand(now: number) {
    return this.state
      ? reconcileNextHandTransition(this.state, now, this.timing())
      : false;
  }

  private timing(): LivePokerTimingConfig {
    const configured = Number(
      envString(this.bindings, "LIVE_POKER_TURN_TIMEOUT_SECONDS") ??
        DEFAULT_LIVE_POKER_TIMING.actionTimeMs / 1000
    );
    const seconds = Number.isFinite(configured)
      ? Math.min(300, Math.max(10, configured))
      : DEFAULT_LIVE_POKER_TIMING.actionTimeMs / 1000;
    return {
      ...DEFAULT_LIVE_POKER_TIMING,
      actionTimeMs: seconds * 1000,
    };
  }

  private async persist() {
    if (!this.state) {
      return;
    }
    await this.ctx.storage.put({ outbox: this.outbox, state: this.state });
    await this.scheduleAlarm();
  }

  private async scheduleAlarm() {
    const deadlines = [
      this.state
        ? getNextLivePokerDeadline(this.state)
        : Number.POSITIVE_INFINITY,
      this.outbox[0]?.nextAttemptAt ?? Number.POSITIVE_INFINITY,
    ];
    const next = Math.min(...deadlines);
    if (Number.isFinite(next)) {
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, next));
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private findSeatByUserId(userId?: string | null) {
    return this.state?.seats.find((candidate) => candidate?.userId === userId);
  }

  private hasOpenConnection(userId?: string, excluding?: WebSocket) {
    if (!userId) {
      return false;
    }
    return this.ctx.getWebSockets().some((connection) => {
      if (
        connection === excluding ||
        connection.readyState !== WebSocket.OPEN
      ) {
        return false;
      }
      const auth = connection.deserializeAttachment() as ConnectionState | null;
      return auth?.userId === userId;
    });
  }

  private disconnectUser(userId: string, reason: string) {
    for (const connection of this.ctx.getWebSockets()) {
      const auth = connection.deserializeAttachment() as ConnectionState | null;
      if (auth?.userId === userId) {
        connection.close(1008, reason);
      }
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
      const seat = this.findSeatByUserId(auth.userId);
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
