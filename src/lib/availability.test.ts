import { describe, expect, it } from "vitest";
import { noAvailabilityMessage } from "./availability";

describe("availability messaging", () => {
  it("explains when a date has no slots", () => {
    expect(noAvailabilityMessage([])).toBe(
      "Não há horários disponíveis para esta data. Escolha outro dia.",
    );
  });

  it("explains when every slot is occupied, blocked, or in the past", () => {
    expect(
      noAvailabilityMessage([{ state: "booked" }, { state: "blocked" }, { state: "past" }]),
    ).toBe("Não há horários disponíveis para esta data. Escolha outro dia.");
  });

  it("does not show the empty-state message when at least one slot is free", () => {
    expect(noAvailabilityMessage([{ state: "booked" }, { state: "free" }])).toBeNull();
  });
});
