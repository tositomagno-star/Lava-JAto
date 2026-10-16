export const TZ = "America/Sao_Paulo";

export const REGION = "Minas Gerais, MG, Brasil";

export function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Today's date (YYYY-MM-DD) in Brasília time. */
export function todaySP(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find(({ type }) => type === "year")?.value;
  const month = parts.find(({ type }) => type === "month")?.value;
  const day = parts.find(({ type }) => type === "day")?.value;
  if (!year || !month || !day)
    throw new Error("Não foi possível calcular a data no fuso de Brasília.");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(iso: string) {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const weekdayShort = (iso: string) => WD[weekday(iso)] ?? "";

export const DEFAULT_SCHEDULE: Record<string, string[]> = {
  "1": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
  "2": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
  "3": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
  "4": ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"],
  "5": ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
  "6": ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
  "0": [],
};

export function parseSchedule(value: unknown): Record<string, string[]> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const schedule: Record<string, string[]> = {};
  for (const [day, times] of Object.entries(value)) {
    if (
      !/^[0-6]$/.test(day) ||
      !Array.isArray(times) ||
      !times.every(
        (time): time is string =>
          typeof time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time),
      )
    ) {
      return null;
    }
    schedule[day] = times;
  }

  if (Object.keys(schedule).length !== 7) return null;
  return schedule;
}

export function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export type OrderSummary = {
  customer_name: string;
  phone: string;
  vehicle_model: string;
  plate: string | null;
  booking_date: string;
  slot_time: string;
  delivery_method: "dropoff" | "pickup";
  arrival_method?: "dropoff" | "pickup";
  return_method?: "customer_pickup" | "delivery";
  cep?: string | null;
  street?: string | null;
  district?: string | null;
  complement?: string | null;
  reference?: string | null;
  notes: string | null;
  pickup_fee: number;
  total: number;
  code?: string;
  professional_name?: string | null;
  professional_phone?: string | null;
  items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
};

export function buildWhatsAppMessage(o: OrderSummary) {
  const subtotal = o.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const pickupFee = Number(o.pickup_fee || 0);
  const lines: string[] = [];

  lines.push("NOVO PEDIDO — MOTO CAR");
  if (o.code) lines.push(`Pedido: #${o.code}`);
  lines.push("", "CLIENTE", `Nome: ${o.customer_name}`, `Telefone: ${o.phone}`);
  lines.push("", "VEÍCULO", `Modelo: ${o.vehicle_model}`, `Placa: ${o.plate || "Não informada"}`);
  lines.push("", "AGENDAMENTO", `Data: ${fmtDate(o.booking_date)}`, `Horário: ${o.slot_time}`);
  lines.push("", "CHEGADA À MOTO CAR");

  if (o.delivery_method === "dropoff") {
    lines.push("Vou levar o veículo até a Moto Car.");
  } else {
    lines.push("Solicitar a retirada do veículo.");
    const addr = [o.street, o.district, o.complement, o.cep ? `CEP ${o.cep}` : null]
      .filter(Boolean)
      .join(", ");
    lines.push(`Endereço: ${addr || "Não informado"}`);
    if (o.reference) lines.push(`Referência: ${o.reference}`);
  }

  lines.push("", "PROFISSIONAL ESCOLHIDO", o.professional_name || "Não informado");
  if (o.arrival_method) {
    lines.push(
      "",
      "ENVIO",
      o.arrival_method === "dropoff" ? "Leve até Moto Car" : "Busque até mim",
    );
  }
  if (o.return_method) {
    lines.push(
      "",
      "ENTREGA",
      o.return_method === "customer_pickup" ? "Buscar em Moto Car" : "Leve até mim",
    );
  }
  lines.push("", "SERVIÇOS SOLICITADOS");

  for (const i of o.items) {
    lines.push(`- ${i.quantity}x ${i.name} — ${brl(Number(i.unit_price))}`);
  }

  lines.push(`Subtotal: ${brl(subtotal)}`);
  if (pickupFee > 0) lines.push(`Taxa de retirada: ${brl(pickupFee)}`);
  lines.push(`TOTAL DO PEDIDO: ${brl(Number(o.total))}`);
  lines.push("", `Observações: ${o.notes?.trim() || "nenhuma"}`);
  lines.push("", "Pedido gerado pelo site da Moto Car.");

  return lines.join("\n");
}

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${onlyDigits(number)}?text=${encodeURIComponent(message)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_send: "Aguardando envio pelo cliente",
  awaiting_confirmation: "Aguardando confirmação",
  confirmed: "Confirmado pela empresa",
  completed: "Concluído",
  cancelled: "Cancelado",
};
