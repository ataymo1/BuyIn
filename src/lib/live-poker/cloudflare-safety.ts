export const LIVE_POKER_CLOSED_OBJECT_RETENTION_MS = 10 * 60 * 1000;
export const LIVE_POKER_MAX_CONNECTIONS_PER_TABLE = 36;
export const LIVE_POKER_MAX_CONNECTIONS_PER_USER = 3;
export const LIVE_POKER_MAX_CONSECUTIVE_TIMEOUTS = 6;
export const LIVE_POKER_MAX_HANDS_PER_TABLE = 250;
export const LIVE_POKER_MAX_MESSAGE_BYTES = 4096;
export const LIVE_POKER_MAX_OUTBOX_ATTEMPTS = 12;
export const LIVE_POKER_MAX_OUTBOX_RETRY_DELAY_MS = 60 * 60 * 1000;

const LIVE_POKER_INITIAL_OUTBOX_RETRY_DELAY_MS = 60 * 1000;
const LIVE_POKER_TABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function getLivePokerOutboxRetryDelay(
  attempts: number,
  randomValue = Math.random()
) {
  const safeAttempts = Math.max(1, Math.floor(attempts));
  const baseDelay = Math.min(
    LIVE_POKER_MAX_OUTBOX_RETRY_DELAY_MS,
    LIVE_POKER_INITIAL_OUTBOX_RETRY_DELAY_MS * 2 ** (safeAttempts - 1)
  );
  const jitter = 0.75 + Math.min(1, Math.max(0, randomValue)) * 0.25;
  return Math.round(baseDelay * jitter);
}

export function isLivePokerMessageWithinLimit(
  message: string | ArrayBuffer
) {
  if (
    typeof message === "string" &&
    message.length > LIVE_POKER_MAX_MESSAGE_BYTES
  ) {
    return false;
  }
  const bytes =
    typeof message === "string"
      ? new TextEncoder().encode(message).byteLength
      : message.byteLength;
  return bytes <= LIVE_POKER_MAX_MESSAGE_BYTES;
}

export function isLivePokerTableId(value: string) {
  return LIVE_POKER_TABLE_ID_PATTERN.test(value);
}

export function isRetryableLivePokerWebhookStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}
