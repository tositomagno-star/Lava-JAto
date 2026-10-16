import { fmtDate, STATUS_LABEL, weekdayShort, type OrderSummary } from "./format";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "./professionals";

export type AgendaOrder = Omit<OrderSummary, "booking_date" | "slot_time"> & {
  id: string;
  status: string;
  professional_name: string | null;
  professional_phone: string | null;
};

export type AgendaBooking = {
  id: string;
  booking_date: string;
  slot_time: string;
  status: string;
  order_id: string;
  orders: AgendaOrder | null;
};

export function bookingWindow(today: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index + 1);
    return date.toISOString().slice(0, 10);
  });
}

function deliveryLabel(booking: AgendaBooking) {
  const order = booking.orders;
  if (!order || order.delivery_method === "dropoff")
    return "Cliente levará o veículo ao estabelecimento";
  const address = [
    order.street,
    order.district,
    order.complement,
    order.cep ? `CEP ${order.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `Buscar no endereço informado${address ? `: ${address}` : ""}`;
}

function confirmedBookings(bookings: AgendaBooking[]) {
  return bookings
    .filter(
      (booking) =>
        booking.status === "active" && booking.orders?.status !== "cancelled" && booking.orders,
    )
    .sort((a, b) => a.slot_time.localeCompare(b.slot_time));
}

function bookingBlock(booking: AgendaBooking) {
  const order = booking.orders!;
  return [
    `*${booking.slot_time} — Cliente:* ${order.customer_name}`,
    `*Telefone:* ${order.phone || "Não informado"}`,
    `*Serviços:* ${order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ") || "Nenhum item listado"}`,
    `*Valor:* ${fmtCurrency(Number(order.total))}`,
    `*Funcionário:* ${order.professional_name || "Não registrado"}`,
    `*Entrega:* ${deliveryLabel(booking)}`,
  ].join("\n");
}

function agendaHeader(date: string, part?: string) {
  return [
    `*AGENDA DO DIA — MOTO CAR LAVA-JATO*${part ? ` (${part})` : ""}`,
    "",
    `*Data:* ${fmtDate(date)} (${weekdayShort(date)})`,
    "",
  ].join("\n");
}

function agendaFooter(totalCount: number, totalValue: number) {
  return `\n*Total de agendamentos:* ${totalCount}\n*Total previsto:* ${fmtCurrency(totalValue)}`;
}

export function buildAgendaMessage(date: string, bookings: AgendaBooking[]) {
  const confirmed = confirmedBookings(bookings);
  const total = confirmed.reduce((sum, booking) => sum + Number(booking.orders?.total || 0), 0);
  const blocks = confirmed.length
    ? confirmed.map(bookingBlock)
    : ["Nenhum agendamento confirmado."];
  return `${agendaHeader(date)}${blocks.join("\n\n")}${agendaFooter(confirmed.length, total)}`;
}

export function splitAgendaMessage(date: string, bookings: AgendaBooking[], maxLength = 3500) {
  const confirmed = confirmedBookings(bookings);
  const total = confirmed.reduce((sum, booking) => sum + Number(booking.orders?.total || 0), 0);
  if (buildAgendaMessage(date, bookings).length <= maxLength)
    return [buildAgendaMessage(date, bookings)];
  if (confirmed.length === 0) return [buildAgendaMessage(date, bookings)];

  const groups: AgendaBooking[][] = [[]];
  for (const booking of confirmed) {
    const lastGroup = groups[groups.length - 1]!;
    const candidate = [...lastGroup, booking];
    const tentative = `${agendaHeader(date, "parte 99/99")}${candidate.map(bookingBlock).join("\n\n")}${agendaFooter(confirmed.length, total)}`;
    if (lastGroup.length && tentative.length > maxLength) groups.push([booking]);
    else lastGroup.push(booking);
  }

  if (
    groups.some(
      (group) =>
        `${agendaHeader(date, `parte ${groups.length}/${groups.length}`)}${group.map(bookingBlock).join("\n\n")}${agendaFooter(confirmed.length, total)}`
          .length > maxLength,
    )
  ) {
    throw new Error(
      "Um agendamento individual excede o limite de tamanho para envio pelo WhatsApp.",
    );
  }

  return groups.map(
    (group, index) =>
      `${agendaHeader(date, `parte ${index + 1}/${groups.length}`)}${group.map(bookingBlock).join("\n\n")}${agendaFooter(confirmed.length, total)}`,
  );
}

export function buildIndividualAgendaMessage(booking: AgendaBooking) {
  const order = booking.orders;
  if (!order) throw new Error("Pedido do agendamento não encontrado.");
  const cancelled = booking.status !== "active" || order.status === "cancelled";
  return [
    "*AGENDAMENTO — MOTO CAR*",
    `*Cliente:* ${order.customer_name}`,
    `*Telefone do cliente:* ${order.phone || "Não informado"}`,
    `*Data:* ${fmtDate(booking.booking_date)} (${weekdayShort(booking.booking_date)})`,
    `*Horário:* ${booking.slot_time}`,
    `*Serviços:*\n${order.items.map((item) => `- ${item.quantity}x ${item.name} — ${fmtCurrency(Number(item.unit_price))}`).join("\n") || "Nenhum item listado"}`,
    `*Total:* ${fmtCurrency(Number(order.total))}`,
    `*Funcionário:* ${order.professional_name || "Não registrado"}`,
    `*Entrega:* ${deliveryLabel(booking)}`,
    `*Status:* ${cancelled ? "Cancelado" : STATUS_LABEL[order.status] || order.status}`,
  ].join("\n");
}

export function buildProfessionalWhatsAppUrl(phone: string | null, message: string) {
  if (!phone || !isValidWhatsAppNumber(phone)) return null;
  return `https://wa.me/${normalizeWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
}

function fmtCurrency(amount: number) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
