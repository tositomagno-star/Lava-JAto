import { randomBytes } from "node:crypto";
import {
  createAdminSessionToken,
  createRateLimitFingerprint,
  getAdminSessionFromToken,
  isAdminSessionActive,
  isAdminSessionTokenValid,
  verifyAdminPasswordHash,
} from "./admin-session";
import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestHeader,
  getRequestIP,
  getRequestProtocol,
  getRequestUrl,
  setCookie,
} from "@tanstack/react-start/server";

const COOKIE_NAME = "motocar_admin_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_RATE_SCRIPT =
  "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return count";

function getRedisUrl() {
  const redisUrl = process.env["UPSTASH_REDIS_REST_URL"];
  const redisToken = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!redisUrl || !redisToken) {
    throw new Error("Admin login is not configured: Upstash Redis credentials are missing.");
  }

  let parsedRedisUrl: URL;
  try {
    parsedRedisUrl = new URL(redisUrl);
  } catch {
    throw new Error("Admin login is not configured: Upstash Redis URL is invalid.");
  }
  if (parsedRedisUrl.protocol !== "https:") {
    throw new Error("Admin login is not configured: Upstash Redis must use HTTPS.");
  }
  return { url: parsedRedisUrl, token: redisToken };
}

async function redisCommand(command: string[]) {
  const { url, token } = getRedisUrl();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error("Admin session storage is temporarily unavailable.");
  }
  if (!response.ok) throw new Error("Admin session storage is temporarily unavailable.");

  let result: { result?: unknown; error?: unknown };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new Error("Admin session storage is temporarily unavailable.");
  }
  if (result.error) throw new Error("Admin session storage is temporarily unavailable.");
  return result.result;
}

function sessionKey(sessionId: string, secret: string) {
  return `motocar-admin-session:${createRateLimitFingerprint(sessionId, secret)}`;
}

function requiredSecret(name: string, minimumLength: number) {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`Admin authentication is not configured: ${name} is missing or too short.`);
  }
  return value;
}

function sessionSecret() {
  return requiredSecret("ADMIN_SESSION_SECRET", 32);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: getRequestProtocol() === "https",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  };
}

export async function authenticateAdminPassword(password: string) {
  const sessionSecretValue = sessionSecret();
  const clientIp =
    getRequestHeader("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestIP() ||
    "unknown";
  const rateKey = `motocar-admin-login:${createRateLimitFingerprint(clientIp, sessionSecretValue)}`;
  let rateLimitResult: unknown;
  try {
    rateLimitResult = await redisCommand([
      "EVAL",
      LOGIN_RATE_SCRIPT,
      "1",
      rateKey,
      String(LOGIN_WINDOW_SECONDS),
    ]);
  } catch {
    throw new Error("Admin login is temporarily unavailable because rate limiting failed.");
  }
  if (typeof rateLimitResult !== "number") {
    throw new Error("Admin login is temporarily unavailable because rate limiting failed.");
  }
  if (rateLimitResult > MAX_LOGIN_ATTEMPTS) {
    return { authenticated: false, rateLimited: true } as const;
  }

  if (!(await verifyAdminPasswordHash(password, requiredSecret("ADMIN_PASSWORD_HASH", 32)))) {
    return { authenticated: false, rateLimited: false } as const;
  }

  const expiresAt = Date.now() + SESSION_LIFETIME_SECONDS * 1000;
  const sessionId = randomBytes(32).toString("base64url");
  const token = createAdminSessionToken(expiresAt, sessionId, sessionSecretValue);
  try {
    const storedSession = await redisCommand([
      "SET",
      sessionKey(sessionId, sessionSecretValue),
      "1",
      "EX",
      String(SESSION_LIFETIME_SECONDS),
    ]);
    if (storedSession !== "OK") throw new Error("Session write rejected.");
    await redisCommand(["DEL", rateKey]);
  } catch {
    throw new Error("Admin login is temporarily unavailable because rate limiting failed.");
  }

  setCookie(COOKIE_NAME, token, cookieOptions());

  return { authenticated: true, rateLimited: false } as const;
}

export async function requireAdminSession() {
  const token = getCookie(COOKIE_NAME);
  const secret = sessionSecret();
  if (!token || !isAdminSessionTokenValid(token, secret)) {
    throw new Error("Sessão administrativa inválida ou expirada.");
  }
  const session = getAdminSessionFromToken(token, secret);
  if (
    !session ||
    !isAdminSessionActive(
      token,
      secret,
      await redisCommand(["GET", sessionKey(session.sessionId, secret)]),
    )
  ) {
    throw new Error("Sessão administrativa inválida ou expirada.");
  }
}

export function assertAdminRequestOrigin() {
  const request = getRequest();
  const origin = request.headers.get("origin");
  const expectedOrigin = getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin;
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin || origin !== expectedOrigin || fetchSite === "cross-site") {
    throw new Error("Requisição administrativa rejeitada.");
  }
}

export async function endAdminSession() {
  const token = getCookie(COOKIE_NAME);
  const secret = sessionSecret();
  const session = token ? getAdminSessionFromToken(token, secret) : false;
  try {
    if (session) await redisCommand(["DEL", sessionKey(session.sessionId, secret)]);
  } finally {
    deleteCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  }
}
