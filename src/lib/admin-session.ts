import { createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

type AdminSession = { expiresAt: number; sessionId: string };

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(expiresAt: number, sessionId: string, secret: string) {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt, sessionId } satisfies AdminSession),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function getAdminSessionFromToken(token: string, secret: string, now = Date.now()) {
  if (token.length > 1024) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  const expectedSignature = Buffer.from(sign(payload, secret));
  const providedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return false;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AdminSession>;
    if (
      !Number.isSafeInteger(session.expiresAt) ||
      Number(session.expiresAt) <= now ||
      typeof session.sessionId !== "string" ||
      !/^[A-Za-z0-9_-]{40,64}$/.test(session.sessionId)
    ) {
      return false;
    }
    return { expiresAt: Number(session.expiresAt), sessionId: session.sessionId };
  } catch {
    return false;
  }
}

export function isAdminSessionTokenValid(token: string, secret: string, now = Date.now()) {
  return Boolean(getAdminSessionFromToken(token, secret, now));
}

export function isAdminSessionActive(
  token: string,
  secret: string,
  storedSession: unknown,
  now = Date.now(),
) {
  return storedSession === "1" && isAdminSessionTokenValid(token, secret, now);
}

export function createRateLimitFingerprint(value: string, secret: string) {
  return sign(value, secret);
}

export function isValidAdminPasswordHash(serializedHash: string) {
  const [algorithm, saltValue, hashValue, extra] = serializedHash.split("$");
  return (
    algorithm === "scrypt" &&
    Boolean(saltValue) &&
    Boolean(hashValue) &&
    !extra &&
    Buffer.from(saltValue!, "base64url").length >= 16 &&
    Buffer.from(hashValue!, "base64url").length === 64
  );
}

export async function verifyAdminPasswordHash(password: string, serializedHash: string) {
  const [algorithm, saltValue, hashValue, extra] = serializedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue || extra) return false;

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  if (salt.length < 16 || expected.length !== 64) return false;

  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}
