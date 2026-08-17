export const LIVE_POKER_MAX_RECONNECT_ATTEMPTS = 6;
export const LIVE_POKER_MAX_RECONNECT_DELAY_MS = 16_000;
const LIVE_POKER_INITIAL_RECONNECT_DELAY_MS = 1000;

export function getLivePokerReconnectDelay(attempt: number) {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(
    LIVE_POKER_INITIAL_RECONNECT_DELAY_MS * 2 ** safeAttempt,
    LIVE_POKER_MAX_RECONNECT_DELAY_MS
  );
}
