import { describe, expect, it } from "vitest";
import { hasRequiredDeliveryChoices } from "./cart-utils";

describe("required cart delivery choices", () => {
  it.each([
    ["dropoff", "customer_pickup", true],
    ["dropoff", "delivery", true],
    ["pickup", "customer_pickup", true],
    ["pickup", "delivery", true],
    [null, "customer_pickup", false],
    ["dropoff", null, false],
    [null, null, false],
  ] as const)("validates arrival %s and return %s", (arrival, returnMethod, expected) => {
    expect(hasRequiredDeliveryChoices(arrival, returnMethod)).toBe(expected);
  });
});
