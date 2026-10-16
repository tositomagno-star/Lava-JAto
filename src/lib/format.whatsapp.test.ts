import { describe, expect, it } from "vitest";
import { brl, buildWhatsAppMessage, type OrderSummary } from "./format";

describe("WhatsApp order summary", () => {
  it("shows the pickup fee separately from the service subtotal", () => {
    const order: OrderSummary = {
      customer_name: "Cliente",
      phone: "31999999999",
      vehicle_model: "Carro",
      plate: null,
      booking_date: "2026-10-17",
      slot_time: "09:00",
      delivery_method: "pickup",
      cep: "30000000",
      street: "Rua Exemplo",
      district: "Centro",
      notes: null,
      pickup_fee: 15,
      total: 115,
      code: "PEDIDO-1",
      professional_name: "Profissional",
      professional_phone: "31988888888",
      items: [{ name: "Lavagem", quantity: 1, unit_price: 100, subtotal: 100 }],
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain(`Subtotal: ${brl(100)}`);
    expect(message).toContain(`Taxa de retirada: ${brl(15)}`);
    expect(message).toContain(`TOTAL DO PEDIDO: ${brl(115)}`);
  });

  it.each([
    ["dropoff", "customer_pickup", "Leve até Moto Car", "Buscar em Moto Car"],
    ["dropoff", "delivery", "Leve até Moto Car", "Leve até mim"],
    ["pickup", "customer_pickup", "Busque até mim", "Buscar em Moto Car"],
    ["pickup", "delivery", "Busque até mim", "Leve até mim"],
  ] as const)(
    "includes the selected arrival and return options in the WhatsApp message",
    (arrival_method, return_method, arrivalLabel, returnLabel) => {
      const order: OrderSummary = {
        customer_name: "Cliente",
        phone: "31999999999",
        vehicle_model: "Carro",
        plate: null,
        booking_date: "2026-10-17",
        slot_time: "09:00",
        delivery_method: arrival_method,
        arrival_method,
        return_method,
        notes: null,
        pickup_fee: 0,
        total: 75,
        items: [
          { name: "Lavagem simples", quantity: 1, unit_price: 40, subtotal: 40 },
          { name: "Limpeza interna", quantity: 1, unit_price: 35, subtotal: 35 },
        ],
      };

      const message = buildWhatsAppMessage(order);

      expect(message).toContain(`ENVIO\n${arrivalLabel}`);
      expect(message).toContain(`ENTREGA\n${returnLabel}`);
      expect(message).toContain(`TOTAL DO PEDIDO: ${brl(75)}`);
    },
  );
});
