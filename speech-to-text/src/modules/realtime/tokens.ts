import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface RealtimeToken {
  token: string;
  expiresAt: number;
}

export interface RealtimeTokenParts {
  jti: string;
  exp: number;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Stateless ephemeral tokens: `<jti>.<exp>.<hmac>` signed with the STT API key.
 * No server-side store required; expiry is embedded and verified on the WS handshake.
 */
export function createRealtimeTokenIssuer(secret: string, ttlSec: number) {
  return {
    issue(now = Date.now()): RealtimeToken {
      const jti = randomUUID();
      const exp = now + ttlSec * 1000;
      const payload = `${jti}.${exp}`;
      return { token: `${payload}.${sign(payload, secret)}`, expiresAt: exp };
    },
    verify(token: string, now = Date.now()): RealtimeTokenParts | null {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [jti, expRaw, mac] = parts;
      const exp = Number(expRaw);
      if (!jti || !Number.isFinite(exp) || expRaw.length === 0) return null;
      const payload = `${jti}.${expRaw}`;
      const expected = Buffer.from(sign(payload, secret));
      const received = Buffer.from(mac);
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return null;
      }
      if (exp <= now) return null;
      return { jti, exp };
    },
  };
}

export type RealtimeTokenIssuer = ReturnType<typeof createRealtimeTokenIssuer>;
