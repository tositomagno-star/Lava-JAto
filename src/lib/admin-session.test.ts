import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  createRateLimitFingerprint,
  getAdminSessionFromToken,
  isAdminSessionActive,
  isAdminSessionTokenValid,
  isValidAdminPasswordHash,
  verifyAdminPasswordHash,
} from "./admin-session";

describe("signed admin sessions", () => {
  const secret = "test-only-secret-with-at-least-32-characters";
  const sessionId = "a".repeat(43);

  it("accepts a valid unexpired signed session", () => {
    const token = createAdminSessionToken(2_000, sessionId, secret);
    expect(isAdminSessionTokenValid(token, secret, 1_000)).toBe(true);
    expect(getAdminSessionFromToken(token, secret, 1_000)).toEqual({
      expiresAt: 2_000,
      sessionId,
    });
    expect(isAdminSessionActive(token, secret, "1", 1_000)).toBe(true);
    expect(isAdminSessionActive(token, secret, null, 1_000)).toBe(false);
    expect(isAdminSessionActive(token, secret, "1", 2_000)).toBe(false);
  });

  it("rejects expired, tampered, and wrong-secret sessions", () => {
    const token = createAdminSessionToken(2_000, sessionId, secret);
    expect(isAdminSessionTokenValid(token, secret, 2_000)).toBe(false);
    expect(isAdminSessionTokenValid(`${token}x`, secret, 1_000)).toBe(false);
    expect(
      isAdminSessionTokenValid(token, "another-secret-with-at-least-32-characters", 1_000),
    ).toBe(false);
    expect(
      isAdminSessionTokenValid(createAdminSessionToken(2_000, "short", secret), secret, 1_000),
    ).toBe(false);
  });

  it("does not expose raw rate-limit identifiers", () => {
    const first = createRateLimitFingerprint("192.0.2.1", secret);
    expect(first).not.toContain("192.0.2.1");
    expect(first).not.toBe(createRateLimitFingerprint("192.0.2.2", secret));
  });

  it("verifies the password against the configured scrypt hash", async () => {
    const password = "a-long-test-password";
    const salt = randomBytes(16);
    const expected = scryptSync(password, salt, 64);
    const serialized = `scrypt$${salt.toString("base64url")}$${expected.toString("base64url")}`;

    expect(isValidAdminPasswordHash(serialized)).toBe(true);
    expect(isValidAdminPasswordHash("invalid")).toBe(false);
    await expect(verifyAdminPasswordHash(password, serialized)).resolves.toBe(true);
    await expect(verifyAdminPasswordHash("incorrect-password", serialized)).resolves.toBe(false);
    await expect(verifyAdminPasswordHash(password, "invalid")).resolves.toBe(false);
  });
});
