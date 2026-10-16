import { beforeEach, describe, expect, it } from "vitest";
import { buildWhatsAppMessage } from "./format";
import {
  DEFAULT_PROFESSIONALS,
  getActiveProfessionals,
  isValidWhatsAppNumber,
  professionalWhatsAppUrl,
  readProfessionals,
  writeProfessionals,
} from "./professionals";

const STORAGE_KEY = "motocar-professionals-v1";

describe("Moto Car professionals", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("seeds Tiago and Heitor with exactly the provided WhatsApp numbers", () => {
    expect(DEFAULT_PROFESSIONALS).toEqual([
      { id: "professional-1", name: "Tiago", phone: "5531982368541", active: true },
      { id: "professional-2", name: "Heitor", phone: "553192531495", active: true },
    ]);

    expect(getActiveProfessionals().map(({ name, phone }) => [name, phone])).toEqual([
      ["Tiago", "5531982368541"],
      ["Heitor", "553192531495"],
    ]);
  });

  it("migrates old placeholder names to the requested employees and keeps active flags", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "professional-1", name: "Profissional 1", phone: "", active: false },
        { id: "professional-2", name: "Profissional 2", phone: "", active: true },
      ]),
    );

    expect(readProfessionals()).toEqual([
      { id: "professional-1", name: "Tiago", phone: "5531982368541", active: false },
      { id: "professional-2", name: "Heitor", phone: "553192531495", active: true },
    ]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")).toEqual(readProfessionals());
  });

  it("persists edits across reloads and accepts both exact numbers", () => {
    const edited = readProfessionals().map((professional) =>
      professional.id === "professional-1"
        ? { ...professional, name: "Tiago Silva" }
        : professional,
    );
    writeProfessionals(edited);

    expect(readProfessionals()[0]?.name).toBe("Tiago Silva");
    expect(isValidWhatsAppNumber("5531982368541")).toBe(true);
    expect(isValidWhatsAppNumber("553192531495")).toBe(true);
  });

  it("builds a complete order message and targets only the selected employee", () => {
    const order = {
      customer_name: "Cliente Teste",
      phone: "31999990000",
      vehicle_model: "Fiat Uno",
      plate: "ABC1D23",
      booking_date: "2026-10-16",
      slot_time: "13:30",
      delivery_method: "dropoff" as const,
      notes: null,
      pickup_fee: 0,
      total: 65,
      items: [{ name: "Lavagem completa P", quantity: 2, unit_price: 32.5, subtotal: 65 }],
    };
    const message = buildWhatsAppMessage({
      ...order,
      professional_name: "Tiago",
      professional_phone: "5531982368541",
    }).replace(/\u00a0/g, " ");
    const tiagoUrl = professionalWhatsAppUrl(DEFAULT_PROFESSIONALS[0]!, message);
    const heitorUrl = professionalWhatsAppUrl(DEFAULT_PROFESSIONALS[1]!, message);

    expect(message).toContain("Nome: Cliente Teste");
    expect(message).toContain("Modelo: Fiat Uno");
    expect(message).toContain("16/10/2026");
    expect(message).toContain("13:30");
    expect(message).toContain("2x Lavagem completa P — R$ 32,50");
    expect(message).toContain("TOTAL DO PEDIDO: R$ 65,00");
    expect(decodeURIComponent(tiagoUrl || "")).toContain("wa.me/5531982368541");
    expect(decodeURIComponent(heitorUrl || "")).toContain("wa.me/553192531495");
    expect(tiagoUrl).not.toContain("wa.me/553192531495");
    expect(heitorUrl).not.toContain("wa.me/5531982368541");
    expect(
      professionalWhatsAppUrl({ ...DEFAULT_PROFESSIONALS[0]!, active: false }, message),
    ).toBeNull();
  });
});
