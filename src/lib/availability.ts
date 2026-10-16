export type AvailabilitySlot = {
  state: "free" | "booked" | "blocked" | "past";
};

export function noAvailabilityMessage(slots: readonly AvailabilitySlot[]) {
  return slots.some((slot) => slot.state === "free")
    ? null
    : "Não há horários disponíveis para esta data. Escolha outro dia.";
}
