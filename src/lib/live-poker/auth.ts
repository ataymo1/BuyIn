import { jwtVerify, SignJWT } from "jose";
import type { LivePokerAuthToken } from "./types";

const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.LIVE_POKER_JWT_SECRET;
  if (!secret) {
    throw new Error("LIVE_POKER_JWT_SECRET is not configured");
  }
  return encoder.encode(secret);
}

export async function signLivePokerToken(payload: LivePokerAuthToken) {
  return await new SignJWT({
    tableConfig: payload.tableConfig,
    tableId: payload.tableId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    userId: payload.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(payload.exp)
    .sign(getSecret());
}

export async function verifyLivePokerToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());

  const tableConfig = payload.tableConfig as
    | LivePokerAuthToken["tableConfig"]
    | undefined;
  if (!tableConfig) {
    throw new Error("Live poker token is missing table configuration");
  }

  return {
    exp: Number(payload.exp),
    tableConfig,
    tableId: String(payload.tableId),
    playerId: String(payload.playerId),
    playerName: String(payload.playerName),
    userId: String(payload.userId),
  } satisfies LivePokerAuthToken;
}
