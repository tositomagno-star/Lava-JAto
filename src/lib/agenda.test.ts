import { describe, expect, it } from "vitest";
import {
  bookingWindow,
  buildAgendaMessage,
  buildIndividualAgendaMessage,
  buildProfessionalWhatsAppUrl,
  splitAgendaMessage,
  type AgendaBooking,
} from "./agenda";

function booking(
  id: string,
  time: string,
  name: string,
  status = "active",
  total = 65,
): AgendaBooking {
  return {
    id,
    booking_date: "2026-10-16",
    slot_time: time,
    status,
    order_id: `order-${id}`,
    orders: {
      id: `order-${id}`,
      code: id,
      customer_name: name,
      phone: "31999990000",
      vehicle_model: "Fiat Uno",
      plate: "ABC1D23",
      delivery_method: "pickup",
      cep: "30110-000",
      street: "Rua A, 10",
      district: "Centro",
      complement: null,
      reference: null,
      notes: null,
      pickup_fee: 0,
      total,
      status: status === "active" ? "awaiting_send" : "cancelled",
      professional_name: "Tiago",
      professional_phone: "5531982368541",
      items: [{ name: "Lavagem completa P", quantity: 1, unit_price: total, subtotal: total }],
    },
  };
}

describe("Agenda booking range and WhatsApp messages", () => {
  it("offers exactly tomorrow through seven days ahead", () => {
    expect(bookingWindow("2026-10-15")).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
  });

  it("lists only active reservations in chronological order with correct totals and delivery details", () => {
    const result = buildAgendaMessage("2026-10-16", [
      booking("late", "10:00", "Maria", "active", 40),
      booking("early", "08:00", "João", "active", 65),
      booking("cancelled", "09:00", "Cancelado", "cancelled", 90),
    ]).replace(/\u00a0/g, " ");

    expect(result.indexOf("08:00 — Cliente")).toBeLessThan(result.indexOf("10:00 — Cliente"));
    expect(result).toContain("*Data:* 16/10/2026");
    expect(result).toContain("*Total de agendamentos:* 2");
    expect(result).toContain("*Total previsto:* R$ 105,00");
    expect(result).toContain("Buscar no endereço informado: Rua A, 10, Centro, CEP 30110-000");
    expect(result).not.toContain("Cancelado");
  });

  it("splits large agendas without losing bookings and retains day totals", () => {
    const bookings = Array.from({ length: 10 }, (_, index) =>
      booking(`order-${index}`, `${String(8 + index).padStart(2, "0")}:00`, `Cliente ${index}`),
    );
    const parts = splitAgendaMessage("2026-10-16", bookings, 600);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= 600)).toBe(true);
    for (let index = 0; index < bookings.length; index += 1) {
      expect(parts.join("\n")).toContain(`Cliente ${index}`);
    }
    expect(parts.every((part) => part.includes("*Total de agendamentos:* 10"))).toBe(true);
    expect(
      parts.every((part) => part.replace(/\u00a0/g, " ").includes("*Total previsto:* R$ 650,00")),
    ).toBe(true);
  });

  it("includes customer, appointment, selected worker and pickup address in individual message", () => {
    const result = buildIndividualAgendaMessage(booking("1", "08:00", "João"));
    const url = buildProfessionalWhatsAppUrl("5531982368541", result);

    expect(result).toContain("*Cliente:* João");
    expect(result).toContain("*Telefone do cliente:* 31999990000");
    expect(result).toContain("*Funcionário:* Tiago");
    expect(result).toContain("Rua A, 10");
    expect(decodeURIComponent(url || "")).toContain("wa.me/5531982368541");
    expect(buildProfessionalWhatsAppUrl("3199999", result)).toBeNull();
  });
});
