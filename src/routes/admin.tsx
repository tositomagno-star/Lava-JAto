import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type AgendaBooking,
  bookingWindow,
  buildIndividualAgendaMessage,
  buildProfessionalWhatsAppUrl,
  splitAgendaMessage,
} from "@/lib/agenda";
import { useSettings } from "@/lib/data";
import { DEFAULT_SCHEDULE, brl, fmtDate, STATUS_LABEL, todaySP } from "@/lib/format";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "@/lib/professionals";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel — Moto Car" },
      { name: "description", content: "Área administrativa Moto Car." },
      { property: "og:title", content: "Painel — Moto Car" },
      { property: "og:description", content: "Área administrativa Moto Car." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type AdminStatus = "checking" | "allowed" | "denied" | "error";
type ProfessionalRow = { id: string; name: string; whatsapp: string; active: boolean };
type SlotRow = { slot_time: string; state: "free" | "booked" | "blocked" | "past" };

const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Segunda-feira",
  "2": "Terça-feira",
  "3": "Quarta-feira",
  "4": "Quinta-feira",
  "5": "Sexta-feira",
  "6": "Sábado",
  "0": "Domingo",
};

function AdminPage() {
  const { data: settings } = useSettings();
  const [adminStatus, setAdminStatus] = useState<AdminStatus>("checking");
  const [accessError, setAccessError] = useState("");
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [bookings, setBookings] = useState<AgendaBooking[]>([]);
  const [dailySlots, setDailySlots] = useState<SlotRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(todaySP());
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [agendaLinks, setAgendaLinks] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfessionals, setIsSavingProfessionals] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [settingsDraft, setSettingsDraft] = useState({
    company_name: settings?.company_name || "Moto Car",
    whatsapp: settings?.whatsapp || "",
    instagram: settings?.instagram || "",
    address: settings?.address || "",
    contact_info: settings?.contact_info || "",
  });

  useEffect(() => {
    setSettingsDraft({
      company_name: settings?.company_name || "Moto Car",
      whatsapp: settings?.whatsapp || "",
      instagram: settings?.instagram || "",
      address: settings?.address || "",
      contact_info: settings?.contact_info || "",
    });
  }, [settings]);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      setAdminStatus("checking");
      setAccessError("");
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (active) {
          setAccessError(error.message);
          setAdminStatus("error");
        }
        return;
      }
      if (!data.user) {
        if (active) setAdminStatus("denied");
        return;
      }

      const { data: hasRole, error: roleError } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      if (active) {
        if (roleError) {
          setAccessError(roleError.message);
          setAdminStatus("error");
        } else {
          setAdminStatus(hasRole ? "allowed" : "denied");
        }
      }
    }

    void checkAdmin();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void checkAdmin();
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (adminStatus !== "allowed") return;
    let active = true;
    setIsLoading(true);
    setLoadError("");
    setBookings([]);
    setDailySlots([]);

    async function refreshData() {
      try {
        const availabilityPromise = bookingWindow(todaySP()).includes(selectedDate)
          ? supabase.rpc("get_availability", { _date: selectedDate })
          : Promise.resolve({ data: [], error: null });
        const [
          { data: bookingData, error: bookingError },
          { data: professionalData, error: professionalError },
          { data: slotData, error: slotError },
        ] = await Promise.all([
          supabase
            .from("bookings")
            .select(
              "id, booking_date, slot_time, status, order_id, orders ( id, code, customer_name, phone, vehicle_model, plate, delivery_method, cep, street, district, complement, reference, notes, subtotal, pickup_fee, total, status, professional_name, professional_phone, items:order_items ( name:service_name, quantity, unit_price, subtotal ) )",
            )
            .eq("booking_date", selectedDate)
            .order("slot_time", { ascending: true }),
          supabase.from("professionals").select("id, name, whatsapp, active").order("name"),
          availabilityPromise,
        ]);

        if (!active) return;
        if (bookingError)
          setLoadError(`Não foi possível carregar os agendamentos: ${bookingError.message}`);
        else setBookings((bookingData || []) as unknown as AgendaBooking[]);
        if (slotError)
          setLoadError((current) =>
            [current, `Não foi possível carregar os horários: ${slotError.message}`]
              .filter(Boolean)
              .join("\n"),
          );
        else setDailySlots((slotData || []) as SlotRow[]);

        if (professionalError)
          setLoadError((current) =>
            [current, `Não foi possível carregar os profissionais: ${professionalError.message}`]
              .filter(Boolean)
              .join("\n"),
          );
        else {
          const list = (professionalData || []) as ProfessionalRow[];
          setProfessionals(list);
          if (
            !list.some(
              (professional) => professional.id === selectedRecipient && professional.active,
            )
          ) {
            setSelectedRecipient(
              list.find(
                (professional) =>
                  professional.active && isValidWhatsAppNumber(professional.whatsapp),
              )?.id || "",
            );
          }
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Falha inesperada ao carregar os dados da agenda.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void refreshData();
    const interval = window.setInterval(() => void refreshData(), 30_000);
    const channel = supabase
      .channel(`admin-agenda-${selectedDate}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => void refreshData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void refreshData(),
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [adminStatus, selectedDate, selectedRecipient]);

  const recipient = professionals.find(
    (professional) => professional.id === selectedRecipient && professional.active,
  );
  const confirmedBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => booking.status === "active" && booking.orders?.status !== "cancelled",
      ),
    [bookings],
  );

  function updateProfessional(
    id: string,
    key: "name" | "whatsapp" | "active",
    value: string | boolean,
  ) {
    setProfessionals((current) =>
      current.map((professional) =>
        professional.id === id ? { ...professional, [key]: value } : professional,
      ),
    );
  }

  async function saveProfessionals() {
    const invalid = professionals.find(
      (professional) => !professional.name.trim() || !isValidWhatsAppNumber(professional.whatsapp),
    );
    if (invalid) {
      setSaveStatus(`Confira o nome e o número do WhatsApp de ${invalid.name || invalid.id}.`);
      return;
    }

    setIsSavingProfessionals(true);
    setSaveStatus("");
    const { error } = await supabase.from("professionals").upsert(
      professionals.map((professional) => ({
        id: professional.id,
        name: professional.name.trim(),
        whatsapp: normalizeWhatsAppNumber(professional.whatsapp),
        active: professional.active,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
    setIsSavingProfessionals(false);
    if (error) setSaveStatus(`Não foi possível salvar profissionais: ${error.message}`);
    else setSaveStatus("Profissionais salvos no Supabase.");
  }

  async function saveSettings() {
    const { error } = await supabase
      .from("settings")
      .update({
        company_name: settingsDraft.company_name,
        whatsapp: settingsDraft.whatsapp || null,
        instagram: settingsDraft.instagram || null,
        address: settingsDraft.address || null,
        contact_info: settingsDraft.contact_info || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaveStatus(
      error ? `Não foi possível salvar configurações: ${error.message}` : "Configurações salvas.",
    );
  }

  function prepareAgendaWhatsApp() {
    if (!recipient || !isValidWhatsAppNumber(recipient.whatsapp)) {
      setSaveStatus("Selecione um destinatário ativo com WhatsApp válido.");
      setAgendaLinks([]);
      return;
    }

    try {
      const messages = splitAgendaMessage(selectedDate, bookings);
      const links = messages.map((message) =>
        buildProfessionalWhatsAppUrl(recipient.whatsapp, message),
      );
      if (links.some((link) => !link)) throw new Error("O número do destinatário não é válido.");
      setAgendaLinks(links as string[]);
      setSaveStatus(
        messages.length > 1
          ? `A agenda foi dividida em ${messages.length} partes; abra cada parte e revise antes de enviar pelo WhatsApp.`
          : "Mensagem pronta. Revise e confirme o envio no WhatsApp.",
      );
    } catch (error) {
      setAgendaLinks([]);
      setSaveStatus(error instanceof Error ? error.message : "Não foi possível preparar a agenda.");
    }
  }

  if (adminStatus === "checking") {
    return (
      <div className="mx-auto flex max-w-xl items-center justify-center gap-3 px-4 py-24">
        <Loader2 className="h-5 w-5 animate-spin" /> Verificando acesso administrativo...
      </div>
    );
  }
  if (adminStatus === "denied") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-3xl">Acesso administrativo necessário</h1>
        <p className="mt-2 text-muted-foreground">
          Entre com uma conta autorizada como administradora para consultar pedidos, agendamentos e
          cadastros.
        </p>
      </div>
    );
  }
  if (adminStatus === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-3xl">Não foi possível verificar o acesso</h1>
        <p className="mt-2 text-destructive">{accessError}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Painel administrativo
        </p>
        <h1 className="mt-2 text-4xl">Moto Car</h1>
      </div>

      {saveStatus && (
        <div className="mb-6 rounded-md border bg-muted/50 px-3 py-2 text-sm">{saveStatus}</div>
      )}
      {loadError && (
        <div className="mb-6 whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Agendamentos do Supabase</span>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="agenda-date">Consultar data</Label>
              <Input
                id="agenda-date"
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setAgendaLinks([]);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-recipient">Destinatário WhatsApp</Label>
              <select
                id="agenda-recipient"
                value={selectedRecipient}
                onChange={(event) => {
                  setSelectedRecipient(event.target.value);
                  setAgendaLinks([]);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um funcionário</option>
                {professionals
                  .filter(
                    (professional) =>
                      professional.active && isValidWhatsAppNumber(professional.whatsapp),
                  )
                  .map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name} · {professional.whatsapp}
                    </option>
                  ))}
              </select>
            </div>
            <Button onClick={prepareAgendaWhatsApp} disabled={!recipient}>
              <MessageCircle className="h-4 w-4" /> Enviar lista pelo WhatsApp
            </Button>
          </div>

          {agendaLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">
              {agendaLinks.map((link, index) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Send className="h-4 w-4" />{" "}
                  {agendaLinks.length > 1
                    ? `Abrir parte ${index + 1} de ${agendaLinks.length}`
                    : "Abrir WhatsApp"}
                </a>
              ))}
            </div>
          )}

          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Atualizando agendamentos...
            </p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há registros de agendamento para {fmtDate(selectedDate)}.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {confirmedBookings.length} confirmado(s) · total previsto{" "}
                {brl(
                  confirmedBookings.reduce(
                    (sum, booking) => sum + Number(booking.orders?.total || 0),
                    0,
                  ),
                )}
              </p>
              {bookings.map((booking) => {
                const order = booking.orders;
                const message = order ? buildIndividualAgendaMessage(booking) : "";
                const link =
                  booking.status === "active" && order?.status !== "cancelled"
                    ? buildProfessionalWhatsAppUrl(order?.professional_phone || null, message)
                    : null;
                const cancelled = booking.status !== "active" || order?.status === "cancelled";
                const statusText = cancelled
                  ? "Cancelado"
                  : STATUS_LABEL[order?.status || ""] || "Agendado";
                return (
                  <article key={booking.id} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {booking.slot_time} · {order?.customer_name || "Cliente sem pedido"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {fmtDate(booking.booking_date)} ·{" "}
                          {order?.phone || "Telefone não informado"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${cancelled ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-700"}`}
                      >
                        {statusText}
                      </span>
                    </div>
                    {order && (
                      <>
                        <p className="mt-3 text-sm">
                          <b>Serviços:</b>{" "}
                          {order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ") ||
                            "Nenhum item"}
                        </p>
                        <p className="mt-1 text-sm">
                          <b>Total:</b> {brl(Number(order.total))} · <b>Entrega:</b>{" "}
                          {order.delivery_method === "pickup"
                            ? "Retirada"
                            : "Cliente leva ao estabelecimento"}
                        </p>
                        {order.delivery_method === "pickup" && (
                          <p className="mt-1 text-sm">
                            <b>Endereço:</b>{" "}
                            {[
                              order.street,
                              order.district,
                              order.complement,
                              order.cep ? `CEP ${order.cep}` : null,
                            ]
                              .filter(Boolean)
                              .join(", ") || "Não informado"}
                          </p>
                        )}
                        <p className="mt-1 text-sm">
                          <b>Funcionário:</b> {order.professional_name || "Não registrado"}
                          {order.professional_phone ? ` · ${order.professional_phone}` : ""}
                        </p>
                      </>
                    )}
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:border-primary"
                      >
                        <MessageCircle className="h-4 w-4" /> Enviar este agendamento
                      </a>
                    )}
                    {booking.status === "active" &&
                      order?.professional_phone &&
                      !isValidWhatsAppNumber(order.professional_phone) && (
                        <p className="mt-2 text-sm text-destructive">
                          WhatsApp salvo para este pedido inválido; envio individual desabilitado.
                        </p>
                      )}
                    {booking.status === "active" && order && !order.professional_phone && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Este pedido antigo não possui o número do funcionário salvo; envio
                        individual desabilitado.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <section className="border-t pt-4">
            <h3 className="font-semibold">Horários disponíveis e ocupados</h3>
            {dailySlots.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {dailySlots.map((slot) => (
                  <span
                    key={slot.slot_time}
                    className={`rounded-md border px-2 py-1 text-xs ${slot.state === "free" ? "border-emerald-500/40 text-emerald-700" : slot.state === "booked" ? "border-primary/40 text-primary" : "border-muted text-muted-foreground"}`}
                  >
                    {slot.slot_time} ·{" "}
                    {slot.state === "free"
                      ? "Livre"
                      : slot.state === "booked"
                        ? "Ocupado"
                        : slot.state === "past"
                          ? "Passado"
                          : "Bloqueado"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                A disponibilidade de horários é consultada para os próximos 7 dias; os agendamentos
                históricos acima continuam consultáveis por data.
              </p>
            )}
          </section>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Horários semanais cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(DEFAULT_SCHEDULE).map(([day, times]) => (
            <div key={day} className="rounded-md border p-3 text-sm">
              <p className="font-semibold">{WEEKDAY_LABELS[day]}</p>
              <p className="mt-1 text-muted-foreground">
                {times.length ? times.join(", ") : "Fechado"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profissionais e WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {professionals.map((professional) => (
              <div key={professional.id} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold">{professional.name}</p>
                  <button
                    type="button"
                    onClick={() =>
                      updateProfessional(professional.id, "active", !professional.active)
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${professional.active ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {professional.active ? "Ativo" : "Inativo"}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={professional.name}
                      onChange={(event) =>
                        updateProfessional(professional.id, "name", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      value={professional.whatsapp}
                      onChange={(event) =>
                        updateProfessional(professional.id, "whatsapp", event.target.value)
                      }
                      placeholder="55 + DDD + número"
                    />
                  </div>
                </div>
                {!isValidWhatsAppNumber(professional.whatsapp) && (
                  <p className="mt-2 text-xs text-destructive">
                    Número inválido. Informe código do Brasil, DDD e número.
                  </p>
                )}
              </div>
            ))}
            <Button
              onClick={saveProfessionals}
              disabled={isSavingProfessionals || professionals.length === 0}
              className="w-full"
            >
              {isSavingProfessionals ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Salvar profissionais
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações da empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input
                value={settingsDraft.company_name}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, company_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp principal</Label>
              <Input
                value={settingsDraft.whatsapp}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, whatsapp: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={settingsDraft.instagram}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, instagram: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Textarea
                value={settingsDraft.address}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, address: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Textarea
                value={settingsDraft.contact_info}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, contact_info: event.target.value }))
                }
              />
            </div>
            <Button onClick={saveSettings} className="w-full">
              Salvar configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
