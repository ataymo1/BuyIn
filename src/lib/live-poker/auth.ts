import { jwtVerify, SignJWT } from "jose";
import type { LivePokerAuthToken } from "./types";

const encoder = new TextEncoder();

function getSecret() {
  const secret =
    process.env.LIVE_POKER_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "development-live-poker-secret";
  return encoder.encode(secret);
}

export async function signLivePokerToken(payload: LivePokerAuthToken) {
  return await new SignJWT({
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

  return {
    exp: Number(payload.exp),
    tableId: String(payload.tableId),
    playerId: String(payload.playerId),
    playerName: String(payload.playerName),
    userId: String(payload.userId),
  } satisfies LivePokerAuthToken;
}
