/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";
import { jwtVerify } from "jose";
import {
  getLivePokerOutboxRetryDelay,
  isLivePokerMessageWithinLimit,
  isLivePokerTableId,
  isRetryableLivePokerWebhookStatus,
  LIVE_POKER_CLOSED_OBJECT_RETENTION_MS,
  LIVE_POKER_MAX_CONNECTIONS_PER_TABLE,
  LIVE_POKER_MAX_CONNECTIONS_PER_USER,
  LIVE_POKER_MAX_CONSECUTIVE_TIMEOUTS,
  LIVE_POKER_MAX_HANDS_PER_TABLE,
  LIVE_POKER_MAX_OUTBOX_ATTEMPTS,
} from "../src/lib/live-poker/cloudflare-safety";
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
  LIVE_POKER_ALLOWED_ORIGINS?: string;
  LIVE_POKER_CONTROL_SECRET?: string;
  LIVE_POKER_IP_RATE_LIMITER: RateLimit;
  LIVE_POKER_JWT_SECRET?: string;
  LIVE_POKER_SETTLEMENT_URL?: string;
  LIVE_POKER_TABLE: DurableObjectNamespace<LivePokerTableDurableObject>;
  LIVE_POKER_USER_RATE_LIMITER: RateLimit;
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
  deadLetteredAt?: number;
  id: string;
  kind: "hand" | "settlement";
  lastError?: string;
  nextAttemptAt: number;
  payload: unknown;
}

interface MessageRateWindow {
  count: number;
  startedAt: number;
}

class WebhookDeliveryError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

const encoder = new TextEncoder();
const LIVE_POKER_PATH_REGEX = /^\/live-poker\/([^/]+)$/;
const LIVE_POKER_CLAIM_PATH_REGEX = /^\/live-poker\/([^/]+)\/claim$/;
const LIVE_POKER_CLOSE_PATH_REGEX = /^\/live-poker\/([^/]+)\/close$/;
const LIVE_POKER_RETRY_PATH_REGEX = /^\/live-poker\/([^/]+)\/retry-dead-letters$/;
const MAX_ACTION_LOG_ENTRIES = 200;
const MAX_APPLIED_REQUEST_IDS = 1000;
const MAX_OUTBOX_DELIVERIES_PER_RUN = 10;
const MAX_PENDING_OUTBOX_DELIVERIES = 100;
const MAX_SOCKET_MESSAGES_PER_WINDOW = 20;
const MAX_TABLE_MESSAGES_PER_WINDOW = 60;
const MAX_USER_MESSAGES_PER_WINDOW = 30;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const OUTBOX_FETCH_TIMEOUT_MS = 10_000;
const OUTBOX_STORAGE_PREFIX = "outbox:";
const SOCKET_PROTOCOL = "buyin-live-poker";
const TOKEN_PROTOCOL_PREFIX = "buyin-auth-";

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

function isValidChipAmount(value: number, allowZero = false) {
  const units = Math.round(value * 100);
  return (
    Number.isFinite(value) &&
    Number.isSafeInteger(units) &&
    Math.abs(value * 100 - units) <= 1e-7 &&
    (allowZero ? units >= 0 : units > 0)
  );
}

function validateTableConfig(config: LivePokerTableConfig) {
  const hasValidPositiveAmounts = [
    config.smallBlind,
    config.bigBlind,
    config.maxBuyIn,
  ].every((amount) => isValidChipAmount(amount));
  const hasValidIdentityAndAmounts =
    Boolean(config.hostUserId) &&
    hasValidPositiveAmounts &&
    isValidChipAmount(config.minBuyIn, true);
  if (
    !hasValidIdentityAndAmounts ||
    config.bigBlind < config.smallBlind ||
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
  const { payload } = await jwtVerify(token, encoder.encode(secret), {
    algorithms: ["HS256"],
  });
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
  if (
    !(
      Number.isFinite(auth.exp) &&
      auth.tableId &&
      auth.playerId &&
      auth.playerName &&
      auth.userId
    )
  ) {
    throw new Error("Invalid live poker token");
  }
  return auth;
}

function send(connection: WebSocket, message: LivePokerServerMessage) {
  if (connection.readyState !== WebSocket.OPEN) {
    return;
  }
  if (connection.bufferedAmount > 64 * 1024) {
    connection.close(1013, "Client is not accepting updates");
    return;
  }
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

function getPathTableId(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  try {
    const tableId = decodeURIComponent(match[1]);
    return isLivePokerTableId(tableId) ? tableId : null;
  } catch {
    return null;
  }
}

function getSocketProtocols(request: Request) {
  return (request.headers.get("Sec-WebSocket-Protocol") ?? "")
    .split(",")
    .map((protocol) => protocol.trim())
    .filter(Boolean);
}

function getSocketToken(request: Request) {
  const protocolToken = getSocketProtocols(request).find((protocol) =>
    protocol.startsWith(TOKEN_PROTOCOL_PREFIX)
  );
  return protocolToken?.slice(TOKEN_PROTOCOL_PREFIX.length) ?? null;
}

function hasWorkerSecret(request: Request, env: Env) {
  const expected = envString(env, "LIVE_POKER_CONTROL_SECRET");
  return Boolean(
    expected && request.headers.get("x-live-poker-secret") === expected
  );
}

function rateLimitedResponse() {
  return new Response("Too many requests", {
    headers: { "Retry-After": "60" },
    status: 429,
  });
}

function isAllowedSocketOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = (envString(env, "LIVE_POKER_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Boolean(origin && allowedOrigins.includes(origin));
}

function isRuntimeConfigured(env: Env) {
  const required: Array<keyof Env> = [
    "LIVE_POKER_ALLOWED_ORIGINS",
    "LIVE_POKER_CONTROL_SECRET",
    "LIVE_POKER_JWT_SECRET",
    "LIVE_POKER_SETTLEMENT_URL",
    "LIVE_POKER_WEBHOOK_SECRET",
    "LIVE_POKER_WEBHOOK_URL",
  ];
  return required.every((key) => Boolean(envString(env, key)));
}

export default {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Admission checks stay together so no route can reach a Durable Object before authentication and abuse controls.
  async fetch(request: Request, env: Env): Promise<Response> {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const ipLimit = await env.LIVE_POKER_IP_RATE_LIMITER.limit({ key: ip });
    if (!ipLimit.success) {
      return rateLimitedResponse();
    }

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const configured = isRuntimeConfigured(env);
      return Response.json(
        { configured, ok: configured, service: "buyin-live-poker" },
        { status: configured ? 200 : 503 }
      );
    }

    const tableId =
      getPathTableId(url.pathname, LIVE_POKER_CLAIM_PATH_REGEX) ??
      getPathTableId(url.pathname, LIVE_POKER_CLOSE_PATH_REGEX) ??
      getPathTableId(url.pathname, LIVE_POKER_RETRY_PATH_REGEX) ??
      getPathTableId(url.pathname, LIVE_POKER_PATH_REGEX);
    if (!tableId) {
      return new Response("Not found", { status: 404 });
    }

    const isSocketPath = LIVE_POKER_PATH_REGEX.test(url.pathname);
    if (isSocketPath) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      if (!isAllowedSocketOrigin(request, env)) {
        return new Response("WebSocket origin is not allowed", { status: 403 });
      }
      const token = getSocketToken(request);
      if (!token || token.length > 4096) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const auth = await verifyToken(env, token);
        if (auth.tableId !== tableId) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userLimit = await env.LIVE_POKER_USER_RATE_LIMITER.limit({
          key: auth.userId,
        });
        if (!userLimit.success) {
          return rateLimitedResponse();
        }
      } catch {
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      if (!hasWorkerSecret(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const id = env.LIVE_POKER_TABLE.idFromName(tableId);
    return await env.LIVE_POKER_TABLE.get(id).fetch(request);
  },
};

export class LivePokerTableDurableObject extends DurableObject<Env> {
  private readonly bindings: Env;
  private flushingOutbox: Promise<void> | null = null;
  private outbox: OutboxDelivery[] = [];
  private readonly pendingOutboxWrites = new Set<string>();
  private readonly socketMessageWindows = new WeakMap<
    WebSocket,
    MessageRateWindow
  >();
  private state: LivePokerState | null = null;
  private readonly tableId: string;
  private tableMessageWindow: MessageRateWindow = { count: 0, startedAt: 0 };
  private readonly userMessageWindows = new Map<string, MessageRateWindow>();
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.bindings = env;
    this.tableId = ctx.id.name ?? "";
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get(["state", "outbox"]);
      this.state = (stored.get("state") as LivePokerState | undefined) ?? null;
      const legacyOutbox =
        (stored.get("outbox") as OutboxDelivery[] | undefined) ?? [];
      const storedOutbox = await ctx.storage.list<OutboxDelivery>({
        prefix: OUTBOX_STORAGE_PREFIX,
      });
      this.outbox = [
        ...storedOutbox.values(),
        ...legacyOutbox.filter(
          (legacy) =>
            !Array.from(storedOutbox.values()).some(
              (delivery) => delivery.id === legacy.id
            )
        ),
      ].sort((left, right) => this.compareOutboxDeliveries(left, right));
      const now = Date.now();
      const repairedConnections = this.repairConnectionState();
      const repairedTiming = this.repairTimingState(now);
      if (legacyOutbox.length > 0 && this.state) {
        await this.persist(this.outbox);
        await ctx.storage.delete("outbox");
      } else if (repairedConnections || repairedTiming) {
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
      if (LIVE_POKER_RETRY_PATH_REGEX.test(url.pathname)) {
        return await this.handleRetryDeadLettersRequest(request);
      }

      const token = getSocketToken(request);
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

      const connectionCapacityError = this.getConnectionCapacityError(auth);
      if (connectionCapacityError) {
        return new Response(connectionCapacityError, {
          headers: { "Retry-After": "60" },
          status: 429,
        });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(auth);

      const seat = this.findSeatByUserId(auth.userId);
      if (seat && !seat.connected) {
        seat.connected = true;
        this.reconcileNextHand(now);
        await this.persist();
        this.broadcast();
      } else {
        this.sendState(server, auth);
      }

      const response = new Response(null, {
        status: 101,
        webSocket: client,
      });
      if (getSocketProtocols(request).includes(SOCKET_PROTOCOL)) {
        response.headers.set("Sec-WebSocket-Protocol", SOCKET_PROTOCOL);
      }
      return response;
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : "Unauthorized",
        { status: 401 }
      );
    }
  }

  async alarm() {
    await this.ready;
    await this.flushOutbox();
    const now = Date.now();
    if (await this.deleteClosedStorageIfDue(now)) {
      return;
    }
    const repairedTiming = this.repairTimingState(now);
    const advancedTiming = this.advanceDueTiming(now);
    if (repairedTiming || advancedTiming) {
      await this.persist();
      this.broadcast();
    } else {
      await this.scheduleAlarm();
    }
  }

  async webSocketMessage(connection: WebSocket, message: string | ArrayBuffer) {
    await this.ready;

    const auth = connection.deserializeAttachment() as ConnectionState | null;
    if (
      !auth ||
      auth.exp * 1000 <= Date.now() ||
      this.state?.admissionsClosed
    ) {
      connection.close(1008, "Unauthorized");
      return;
    }

    try {
      if (!isLivePokerMessageWithinLimit(message)) {
        connection.close(1009, "Message is too large");
        return;
      }
      const now = Date.now();
      if (!this.consumeMessageRate(connection, auth.userId, now)) {
        connection.close(1008, "Message rate limit exceeded");
        return;
      }
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
      if (
        parsed.data.type === "joinTable" ||
        parsed.data.type === "requestSync"
      ) {
        this.sendState(connection, auth);
        return;
      }

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
      if (this.hasDueOutbox()) {
        this.ctx.waitUntil(this.flushOutboxAndScheduleAlarm());
      }
    } catch (error) {
      send(connection, {
        type: "actionRejected",
        message: error instanceof Error ? error.message : "Action rejected",
      });
    }
  }

  async webSocketClose(connection: WebSocket, code: number, reason: string) {
    await this.ready;
    this.socketMessageWindows.delete(connection);
    const auth = connection.deserializeAttachment() as ConnectionState | null;
    const seat = this.findSeatByUserId(auth?.userId);
    if (seat && !this.hasOpenConnection(auth?.userId, connection)) {
      seat.connected = false;
      this.reconcileNextHand(Date.now());
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
        ].slice(-MAX_APPLIED_REQUEST_IDS);
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

      if (this.state.phase !== "waiting") {
        throw new Error("Finish the current hand before closing the table");
      }

      const occupiedSeats = this.state.seats.filter(
        (seat): seat is LivePokerSeat => seat !== null
      );
      this.ensureOutboxCapacity(occupiedSeats.length);
      this.state.admissionsClosed = true;
      this.state.storageDeleteAt =
        Date.now() + LIVE_POKER_CLOSED_OBJECT_RETENTION_MS;
      for (const seat of occupiedSeats) {
        this.queueSettlement(seat);
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
      return Response.json({ ok: true, pendingDeliveries: this.outbox.length });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Unable to close" },
        { status: 409 }
      );
    }
  }

  private async handleRetryDeadLettersRequest(request: Request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!this.hasWorkerSecret(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const deadLetters = this.outbox.filter(
      (delivery) => delivery.deadLetteredAt
    );
    const retriedIds = new Set(deadLetters.map((delivery) => delivery.id));
    const now = Date.now();
    for (const delivery of deadLetters) {
      delivery.attempts = 0;
      delivery.deadLetteredAt = undefined;
      delivery.lastError = undefined;
      delivery.nextAttemptAt = now;
    }
    if (deadLetters.length > 0) {
      await this.persist(deadLetters);
      await this.flushOutboxAndScheduleAlarm();
    }
    const remaining = this.outbox.filter((delivery) =>
      retriedIds.has(delivery.id)
    );
    const stillDeadLettered = remaining.filter(
      (delivery) => delivery.deadLetteredAt
    );
    let status = 200;
    if (stillDeadLettered.length > 0) {
      status = 502;
    } else if (remaining.length > 0) {
      status = 202;
    }
    return Response.json(
      {
        deadLettered: stillDeadLettered.length,
        delivered: deadLetters.length - remaining.length,
        errors: stillDeadLettered.slice(0, 10).map((delivery) => ({
          id: delivery.id,
          lastError: delivery.lastError ?? "Delivery failed",
        })),
        ok: remaining.length === 0,
        pending: remaining.length - stillDeadLettered.length,
        retried: deadLetters.length,
      },
      { status }
    );
  }

  private hasWorkerSecret(request: Request) {
    return hasWorkerSecret(request, this.bindings);
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
    if (message.type === "setTablePaused") {
      this.requireHost(auth.userId);
      this.state.gamePaused = message.paused;
      if (!message.paused) {
        this.state.consecutiveTimeoutActions = 0;
      }
      let pauseMessage = "The host resumed the table";
      if (message.paused) {
        pauseMessage =
          this.state.phase === "waiting"
            ? "The host paused the table"
            : "The host will pause the table after this hand";
      }
      this.state.actionLog.push(pauseMessage);
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
    const previousCommunityCardCount = this.state.communityCards.length;
    applyAction(this.state, auth.userId, message);
    this.state.consecutiveTimeoutActions = 0;
    this.state.communityCardRevealStartIndex =
      this.state.communityCards.length > previousCommunityCardCount
        ? previousCommunityCardCount
        : null;
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
      const seat = this.findSeatByUserId(claim.userId);
      if (seat) {
        seat.connected = this.hasOpenConnection(claim.userId);
      }
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
    const deliveryId = `${this.tableId}:hand:${this.state.handNumber}`;
    if (!this.outbox.some((delivery) => delivery.id === deliveryId)) {
      this.ensureOutboxCapacity(1);
    }
    const pot = calculatePot(this.state);
    const winners = settleShowdown(this.state);
    const communityCards = [...this.state.communityCards];
    this.state.actionLog.push(
      `Hand ${this.state.handNumber} ended: ${winners
        .map((winner) => `${winner.amount} to seat ${winner.seatIndex + 1}`)
        .join(", ")}`
    );
    this.queueCompletedHand(pot, winners, communityCards);
  }

  private outboxStorageKey(id: string) {
    return `${OUTBOX_STORAGE_PREFIX}${id}`;
  }

  private ensureOutboxCapacity(additionalDeliveries: number) {
    if (
      this.outbox.length + additionalDeliveries >
      MAX_PENDING_OUTBOX_DELIVERIES
    ) {
      throw new Error(
        "Live poker persistence is temporarily backed up; try again shortly"
      );
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
    this.pendingOutboxWrites.add(deliveryId);
  }

  private queueSettlement(seat: LivePokerSeat) {
    this.ensureOutboxCapacity(1);
    const id = `${this.tableId}:settlement:${crypto.randomUUID()}`;
    this.outbox.push({
      attempts: 0,
      id,
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
    this.pendingOutboxWrites.add(id);
  }

  private flushOutbox() {
    if (!this.flushingOutbox) {
      this.flushingOutbox = this.drainOutbox().finally(() => {
        this.flushingOutbox = null;
      });
    }
    return this.flushingOutbox;
  }

  private async flushOutboxAndScheduleAlarm() {
    await this.flushOutbox();
    await this.scheduleAlarm();
  }

  private compareOutboxDeliveries(
    left: OutboxDelivery,
    right: OutboxDelivery
  ) {
    if (Boolean(left.deadLetteredAt) !== Boolean(right.deadLetteredAt)) {
      return left.deadLetteredAt ? 1 : -1;
    }
    return (
      left.nextAttemptAt - right.nextAttemptAt || left.id.localeCompare(right.id)
    );
  }

  private nextPendingOutboxDelivery() {
    this.outbox.sort((left, right) =>
      this.compareOutboxDeliveries(left, right)
    );
    return this.outbox.find((delivery) => !delivery.deadLetteredAt);
  }

  private hasDueOutbox(now = Date.now()) {
    const delivery = this.nextPendingOutboxDelivery();
    return Boolean(delivery && delivery.nextAttemptAt <= now);
  }

  private async drainOutbox() {
    let processed = 0;
    while (processed < MAX_OUTBOX_DELIVERIES_PER_RUN) {
      const delivery = this.nextPendingOutboxDelivery();
      if (!delivery || delivery.nextAttemptAt > Date.now()) {
        break;
      }
      processed += 1;

      try {
        await this.deliverOutboxItem(delivery);
        this.outbox = this.outbox.filter(
          (candidate) => candidate.id !== delivery.id
        );
        this.pendingOutboxWrites.delete(delivery.id);
        await this.ctx.storage.delete(this.outboxStorageKey(delivery.id));
      } catch (error) {
        const now = Date.now();
        delivery.attempts += 1;
        delivery.lastError = (
          error instanceof Error ? error.message : "Webhook delivery failed"
        ).slice(0, 160);
        const retryable =
          !(error instanceof WebhookDeliveryError) || error.retryable;
        if (
          !retryable ||
          delivery.attempts >= LIVE_POKER_MAX_OUTBOX_ATTEMPTS
        ) {
          delivery.deadLetteredAt = now;
        } else {
          delivery.nextAttemptAt =
            now + getLivePokerOutboxRetryDelay(delivery.attempts);
        }
        await this.ctx.storage.put(
          this.outboxStorageKey(delivery.id),
          delivery
        );
      }
    }

    if (
      this.state?.phase === "waiting" &&
      !this.state.gamePaused &&
      this.outbox.some((delivery) => delivery.deadLetteredAt)
    ) {
      this.state.gamePaused = true;
      clearLivePokerTiming(this.state);
      this.state.actionLog.push(
        "Table paused because completed data needs manual delivery recovery"
      );
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
      signal: AbortSignal.timeout(OUTBOX_FETCH_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    if (!response.ok) {
      throw new WebhookDeliveryError(
        `Webhook failed with status ${response.status}`,
        isRetryableLivePokerWebhookStatus(response.status)
      );
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
        this.state.consecutiveTimeoutActions =
          (this.state.consecutiveTimeoutActions ?? 0) + 1;
        if (
          this.state.consecutiveTimeoutActions >=
            LIVE_POKER_MAX_CONSECUTIVE_TIMEOUTS &&
          !this.state.gamePaused
        ) {
          this.state.gamePaused = true;
          this.state.actionLog.push(
            "Table auto-paused after repeated unattended turns"
          );
        }
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
        const previousCommunityCardCount = this.state.communityCards.length;
        revealNextRunoutStage(this.state);
        this.state.communityCardRevealStartIndex =
          this.state.communityCards.length > previousCommunityCardCount
            ? previousCommunityCardCount
            : null;
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
        this.state.communityCardRevealStartIndex = null;
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

    // Persist the bounded batch and let the next alarm continue catch-up. This
    // avoids repeatedly failing a table after a long suspension.
    return changed;
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
    if (!this.state) {
      return false;
    }
    if (
      this.state.phase === "waiting" &&
      !this.state.gamePaused &&
      this.state.handNumber >= LIVE_POKER_MAX_HANDS_PER_TABLE
    ) {
      this.state.gamePaused = true;
      clearLivePokerTiming(this.state);
      this.state.actionLog.push(
        `Table reached its ${LIVE_POKER_MAX_HANDS_PER_TABLE}-hand safety limit; close it and create a new table`
      );
      return true;
    }
    if (
      this.state.phase === "waiting" &&
      !this.state.gamePaused &&
      (this.outbox.length >= MAX_PENDING_OUTBOX_DELIVERIES ||
        this.outbox.some((delivery) => delivery.deadLetteredAt))
    ) {
      this.state.gamePaused = true;
      clearLivePokerTiming(this.state);
      this.state.actionLog.push(
        "Table paused while completed data waits to be persisted"
      );
      return true;
    }
    return reconcileNextHandTransition(this.state, now, this.timing());
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

  private async persist(additionalOutbox: OutboxDelivery[] = []) {
    if (!this.state) {
      return;
    }
    this.state.actionLog = this.state.actionLog.slice(-MAX_ACTION_LOG_ENTRIES);
    this.state.appliedRequestIds = (this.state.appliedRequestIds ?? []).slice(
      -MAX_APPLIED_REQUEST_IDS
    );
    const outboxIds = new Set([
      ...this.pendingOutboxWrites,
      ...additionalOutbox.map((delivery) => delivery.id),
    ]);
    const records: Record<string, LivePokerState | OutboxDelivery> = {
      state: this.state,
    };
    for (const delivery of this.outbox) {
      if (outboxIds.has(delivery.id)) {
        records[this.outboxStorageKey(delivery.id)] = delivery;
      }
    }
    await this.ctx.storage.put(records);
    for (const id of outboxIds) {
      this.pendingOutboxWrites.delete(id);
    }
    await this.scheduleAlarm();
  }

  private async scheduleAlarm() {
    const pendingOutbox = this.nextPendingOutboxDelivery();
    const closedStorageDeadline =
      this.state?.admissionsClosed && this.outbox.length === 0
        ? (this.state.storageDeleteAt ?? Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY;
    const deadlines = [
      this.state
        ? getNextLivePokerDeadline(this.state)
        : Number.POSITIVE_INFINITY,
      pendingOutbox?.nextAttemptAt ?? Number.POSITIVE_INFINITY,
      closedStorageDeadline,
    ];
    const next = Math.min(...deadlines);
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (Number.isFinite(next)) {
      const target = Math.max(Date.now() + 1, next);
      if (currentAlarm !== target) {
        await this.ctx.storage.setAlarm(target);
      }
    } else if (currentAlarm !== null) {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private async deleteClosedStorageIfDue(now: number) {
    if (
      !this.state?.admissionsClosed ||
      this.outbox.length > 0 ||
      !this.state.storageDeleteAt ||
      this.state.storageDeleteAt > now
    ) {
      return false;
    }
    for (const connection of this.ctx.getWebSockets()) {
      connection.close(1001, "Table storage expired");
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.pendingOutboxWrites.clear();
    this.outbox = [];
    this.state = null;
    return true;
  }

  private repairConnectionState() {
    if (!this.state) {
      return false;
    }
    let changed = false;
    for (const seat of this.state.seats) {
      if (!seat) {
        continue;
      }
      const connected = this.hasOpenConnection(seat.userId);
      if (seat.connected !== connected) {
        seat.connected = connected;
        changed = true;
      }
    }
    return changed;
  }

  private getConnectionCapacityError(auth: LivePokerAuthToken) {
    const now = Date.now();
    const activeConnections = this.ctx.getWebSockets().filter((connection) => {
      const connectionAuth =
        connection.deserializeAttachment() as ConnectionState | null;
      const active = Boolean(
        connection.readyState === WebSocket.OPEN &&
          connectionAuth &&
          connectionAuth.exp * 1000 > now
      );
      if (!active) {
        connection.close(1008, "Credentials expired");
      }
      return active;
    });
    if (activeConnections.length >= LIVE_POKER_MAX_CONNECTIONS_PER_TABLE) {
      return "This table has too many active connections";
    }
    const userConnections = activeConnections.filter((connection) => {
      const connectionAuth =
        connection.deserializeAttachment() as ConnectionState | null;
      return connectionAuth?.userId === auth.userId;
    });
    return userConnections.length >= LIVE_POKER_MAX_CONNECTIONS_PER_USER
      ? "This user has too many active table connections"
      : null;
  }

  private consumeMessageRate(
    connection: WebSocket,
    userId: string,
    now: number
  ) {
    const increment = (
      current: MessageRateWindow | undefined,
      limit: number
    ): [boolean, MessageRateWindow] => {
      const window =
        !current || now - current.startedAt >= MESSAGE_RATE_WINDOW_MS
          ? { count: 0, startedAt: now }
          : current;
      window.count += 1;
      return [window.count <= limit, window];
    };

    const tableWindowExpired =
      now - this.tableMessageWindow.startedAt >= MESSAGE_RATE_WINDOW_MS;
    if (tableWindowExpired) {
      this.userMessageWindows.clear();
    }
    const [tableAllowed, tableWindow] = increment(
      this.tableMessageWindow,
      MAX_TABLE_MESSAGES_PER_WINDOW
    );
    this.tableMessageWindow = tableWindow;
    const [userAllowed, userWindow] = increment(
      this.userMessageWindows.get(userId),
      MAX_USER_MESSAGES_PER_WINDOW
    );
    this.userMessageWindows.set(userId, userWindow);
    const [socketAllowed, socketWindow] = increment(
      this.socketMessageWindows.get(connection),
      MAX_SOCKET_MESSAGES_PER_WINDOW
    );
    this.socketMessageWindows.set(connection, socketWindow);
    return tableAllowed && userAllowed && socketAllowed;
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
      return Boolean(
        auth && auth.exp * 1000 > Date.now() && auth.userId === userId
      );
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

  private sendState(connection: WebSocket, auth: LivePokerAuthToken) {
    if (!this.state) {
      return;
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

  private broadcast() {
    if (!this.state) {
      return;
    }

    for (const connection of this.ctx.getWebSockets()) {
      const auth = connection.deserializeAttachment() as ConnectionState | null;
      if (!auth || auth.exp * 1000 <= Date.now()) {
        connection.close(1008, "Credentials expired");
        continue;
      }
      this.sendState(connection, auth);
    }
  }

  private broadcastMessage(message: LivePokerServerMessage) {
    const rawMessage = JSON.stringify(message);
    for (const connection of this.ctx.getWebSockets()) {
      const auth = connection.deserializeAttachment() as ConnectionState | null;
      if (!auth || auth.exp * 1000 <= Date.now()) {
        connection.close(1008, "Credentials expired");
      } else if (connection.readyState === WebSocket.OPEN) {
        if (connection.bufferedAmount > 64 * 1024) {
          connection.close(1013, "Client is not accepting updates");
        } else {
          connection.send(rawMessage);
        }
      }
    }
  }
}
