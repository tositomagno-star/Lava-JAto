import { beforeEach, describe, expect, it } from "vitest";
import { clearCheckoutConfirmationToken, getCheckoutConfirmationToken } from "./checkout-token";

describe("checkout confirmation token persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("reuses a valid token after a page reload", () => {
    const first = getCheckoutConfirmationToken(sessionStorage);
    expect(getCheckoutConfirmationToken(sessionStorage)).toBe(first);
  });

  it("replaces invalid stored data with a UUID token", () => {
    sessionStorage.setItem("motocar-checkout-confirmation-token-v1", "invalid");
    const token = getCheckoutConfirmationToken(sessionStorage);
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("clears the token only after the order flow succeeds", () => {
    const first = getCheckoutConfirmationToken(sessionStorage);
    clearCheckoutConfirmationToken(sessionStorage);
    expect(getCheckoutConfirmationToken(sessionStorage)).not.toBe(first);
  });
});
