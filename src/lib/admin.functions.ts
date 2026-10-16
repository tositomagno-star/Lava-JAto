import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertAdminRequestOrigin,
  authenticateAdminPassword,
  endAdminSession,
  requireAdminSession,
} from "./admin-security.server";
import { isValidAdminPasswordHash } from "./admin-session";
import { addDays, todaySP } from "./format";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "./professionals";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const loginSchema = z.object({ password: z.string().min(1).max(512) });
const bookingDateSchema = z.object({
  date: dateSchema,
  availabilityDate: dateSchema.optional(),
});
const bookingIdSchema = z.object({ bookingId: z.string().uuid() });
const slotSchema = z.object({
  date: dateSchema,
  slotTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});
const orderFiltersSchema = z.object({
  date: dateSchema.optional(),
  status: z
    .enum(["all", "awaiting_send", "awaiting_confirmation", "confirmed", "completed", "cancelled"])
    .default("all"),
});
const professionalSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  whatsapp: z.string().min(1).max(30),
  active: z.boolean(),
});
const professionalsSchema = z.object({ professionals: z.array(professionalSchema).max(50) });
const settingsSchema = z.object({
  company_name: z.string().trim().min(1).max(100),
  whatsapp: z.string().max(30),
  instagram: z.string().max(255),
  address: z.string().max(500),
  contact_info: z.string().max(500),
});

async function getAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdmin() {
  await requireAdminSession();
  return getAdminDb();
}

function isServiceRoleKey(value: string | undefined) {
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return value.length > "sb_secret_".length;
  const payload = value.split(".")[1];
  if (!payload) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: unknown;
    };
    return parsed.role === "service_role";
  } catch {
    return false;
  }
}

async function getAvailability(db: Awaited<ReturnType<typeof getAdminDb>>, date: string) {
  const { data, error } = await db.rpc("get_availability", { _date: date });
  if (error) throw new Error(`Não foi possível verificar os horários: ${error.message}`);
  return (data || []) as { slot_time: string; state: "free" | "booked" | "blocked" | "past" }[];
}

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  let supabaseUrlIsValid = false;
  try {
    const parsedUrl = new URL(process.env["SUPABASE_URL"] || "");
    supabaseUrlIsValid =
      parsedUrl.protocol === "https:" && parsedUrl.hostname === "jbrxnnzkewipjpixcbfa.supabase.co";
  } catch {
    supabaseUrlIsValid = false;
  }
  const configured = Boolean(
    isValidAdminPasswordHash(process.env["ADMIN_PASSWORD_HASH"] || "") &&
    (process.env["ADMIN_SESSION_SECRET"]?.length || 0) >= 32 &&
    process.env["UPSTASH_REDIS_REST_URL"]?.startsWith("https://") &&
    process.env["UPSTASH_REDIS_REST_TOKEN"] &&
    supabaseUrlIsValid &&
    isServiceRoleKey(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
  );
  if (!configured) return { authenticated: false, configured: false };

  try {
    await requireAdminSession();
    return { authenticated: true, configured: true };
  } catch {
    return { authenticated: false, configured: true };
  }
});

export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    assertAdminRequestOrigin();
    try {
      return await authenticateAdminPassword(data.password);
    } catch (error) {
      console.error(
        "[Admin] Login configuration or rate limiter failed.",
        error instanceof Error ? error.name : "Unknown error type",
      );
      throw new Error("O acesso administrativo está temporariamente indisponível.");
    }
  });

export const logoutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  assertAdminRequestOrigin();
  await endAdminSession();
  return { ok: true };
});

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = await requireAdmin();
  const today = todaySP();
  const lastDate = addDays(today, 7);

  const [
    { count: todayCount, error: todayError },
    { count: orderCount, error: orderError },
    { data: upcoming, error: upcomingError },
  ] = await Promise.all([
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_date", today)
      .eq("status", "active"),
    db.from("orders").select("id", { count: "exact", head: true }),
    db
      .from("bookings")
      .select(
        "id, booking_date, slot_time, status, order_id, orders ( id, code, customer_name, phone, total, status, professional_name, items:order_items ( name:service_name, quantity ) )",
      )
      .eq("status", "active")
      .gte("booking_date", today)
      .lte("booking_date", lastDate)
      .order("booking_date")
      .order("slot_time")
      .limit(20),
  ]);

  if (todayError || orderError || upcomingError) {
    throw new Error(
      `Não foi possível carregar o painel: ${todayError?.message || orderError?.message || upcomingError?.message}`,
    );
  }

  return {
    todayCount: todayCount || 0,
    orderCount: orderCount || 0,
    upcoming: (upcoming || []) as unknown as AdminBooking[],
  };
});

export const getAdminBookings = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => bookingDateSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    const [{ data: bookings, error: bookingsError }, slots] = await Promise.all([
      db
        .from("bookings")
        .select(
          "id, booking_date, slot_time, status, order_id, orders ( id, code, customer_name, phone, vehicle_model, plate, delivery_method, cep, street, district, complement, reference, notes, subtotal, pickup_fee, total, status, professional_name, professional_phone, items:order_items ( name:service_name, quantity, unit_price, subtotal ) )",
        )
        .eq("booking_date", data.date)
        .order("slot_time"),
      getAvailability(db, data.availabilityDate || data.date),
    ]);

    if (bookingsError)
      throw new Error(`Não foi possível carregar os agendamentos: ${bookingsError.message}`);
    return {
      bookings: (bookings || []) as unknown as AdminBooking[],
      slots,
    };
  });

export const cancelAdminBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingIdSchema.parse(input))
  .handler(async ({ data }) => {
    assertAdminRequestOrigin();
    const db = await requireAdmin();
    const { data: booking, error: readError } = await db
      .from("bookings")
      .select("id, booking_date, slot_time, status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (readError)
      throw new Error(`Não foi possível consultar o agendamento: ${readError.message}`);
    if (!booking) throw new Error("Agendamento não encontrado.");
    if (booking.status !== "active") throw new Error("Este agendamento já está desmarcado.");

    const { data: updatedBooking, error: updateError } = await db
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (updateError)
      throw new Error(`Não foi possível desmarcar o agendamento: ${updateError.message}`);
    if (!updatedBooking) throw new Error("O agendamento já foi alterado por outra sessão.");

    const slots = await getAvailability(db, booking.booking_date);
    return {
      ok: true,
      slotState: slots.find((slot) => slot.slot_time === booking.slot_time)?.state || "unavailable",
    };
  });

export const setAdminSlotBlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => slotSchema.extend({ blocked: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    assertAdminRequestOrigin();
    const db = await requireAdmin();
    const { error } = await db.rpc("admin_set_slot_block", {
      _date: data.date,
      _slot_time: data.slotTime,
      _blocked: data.blocked,
    });
    if (error) throw new Error(`Não foi possível atualizar o horário: ${error.message}`);

    const refreshedSlots = await getAvailability(db, data.date);
    return {
      ok: true,
      slotState:
        refreshedSlots.find((current) => current.slot_time === data.slotTime)?.state ||
        "unavailable",
    };
  });

export const getAdminOrders = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => orderFiltersSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    let query = db
      .from("orders")
      .select(
        "id, code, customer_name, phone, vehicle_model, plate, delivery_method, cep, street, district, complement, reference, notes, subtotal, pickup_fee, total, status, payment_status, paid_amount, created_at, professional_name, professional_phone, bookings ( booking_date, slot_time, status ), items:order_items ( id, service_name, quantity, unit_price, subtotal )",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.date) {
      query = query
        .gte("created_at", `${data.date}T00:00:00-03:00`)
        .lt("created_at", `${addDays(data.date, 1)}T00:00:00-03:00`);
    }

    const { data: orders, error } = await query;
    if (error) throw new Error(`Não foi possível carregar os pedidos: ${error.message}`);
    return (orders || []) as unknown as AdminOrder[];
  });

export const getAdminConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const db = await requireAdmin();
  const [
    { data: settings, error: settingsError },
    { data: professionals, error: professionalsError },
  ] = await Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db.from("professionals").select("id, name, whatsapp, active").order("name"),
  ]);
  if (settingsError || professionalsError) {
    throw new Error(
      `Não foi possível carregar as configurações: ${settingsError?.message || professionalsError?.message}`,
    );
  }
  return {
    settings,
    professionals: (professionals || []) as {
      id: string;
      name: string;
      whatsapp: string;
      active: boolean;
    }[],
  };
});

export const saveAdminProfessionals = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => professionalsSchema.parse(input))
  .handler(async ({ data }) => {
    assertAdminRequestOrigin();
    const db = await requireAdmin();
    if (data.professionals.some((professional) => !isValidWhatsAppNumber(professional.whatsapp))) {
      throw new Error("Todos os profissionais precisam de um WhatsApp válido.");
    }
    const { error } = await db.from("professionals").upsert(
      data.professionals.map((professional) => ({
        ...professional,
        whatsapp: normalizeWhatsAppNumber(professional.whatsapp),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
    if (error) throw new Error(`Não foi possível salvar profissionais: ${error.message}`);
    return { ok: true };
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data }) => {
    assertAdminRequestOrigin();
    const db = await requireAdmin();
    if (data.whatsapp && !isValidWhatsAppNumber(data.whatsapp)) {
      throw new Error("Informe um WhatsApp comercial válido.");
    }
    const { error } = await db
      .from("settings")
      .update({
        company_name: data.company_name,
        whatsapp: data.whatsapp ? normalizeWhatsAppNumber(data.whatsapp) : null,
        instagram: data.instagram || null,
        address: data.address || null,
        contact_info: data.contact_info || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(`Não foi possível salvar as configurações: ${error.message}`);
    return { ok: true };
  });

type AdminBooking = {
  id: string;
  booking_date: string;
  slot_time: string;
  status: string;
  order_id: string;
  orders: {
    id: string;
    code: string;
    customer_name: string;
    phone: string;
    total: number;
    status: string;
    professional_name: string | null;
    items: { name: string; quantity: number }[];
  } | null;
};

type AdminOrder = {
  id: string;
  code: string;
  customer_name: string;
  phone: string;
  vehicle_model: string;
  plate: string | null;
  delivery_method: string;
  cep: string | null;
  street: string | null;
  district: string | null;
  complement: string | null;
  reference: string | null;
  notes: string | null;
  subtotal: number;
  pickup_fee: number;
  total: number;
  status: string;
  payment_status: string;
  paid_amount: number;
  created_at: string;
  professional_name: string | null;
  professional_phone: string | null;
  bookings: { booking_date: string; slot_time: string; status: string }[] | null;
  items: {
    id: string;
    service_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};
