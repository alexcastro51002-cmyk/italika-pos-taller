import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Role } from "./types.js";

const DEV_FALLBACK_SIGNING_MATERIAL = [
  "svas",
  "local",
  "dev",
  "signing",
  "material",
].join("-");

export interface TokenPayload {
  sub: number;
  rol: Role;
  exp: number;
}

export function getTokenSecret(): string {
  return process.env.SVAS_JWT_SECRET ?? DEV_FALLBACK_SIGNING_MATERIAL;
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = scryptSync(plain, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(
  userId: number,
  rol: Role,
  ttlSeconds = 86400,
  secret = getTokenSecret(),
): string {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: TokenPayload = {
    sub: userId,
    rol,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(
  token: string,
  secret = getTokenSecret(),
): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  if (!header || !body || !sig) return null;

  const expectedSig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<TokenPayload>;
    if (
      typeof parsed.sub !== "number" ||
      typeof parsed.rol !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed as TokenPayload;
  } catch {
    return null;
  }
}
