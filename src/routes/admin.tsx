import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelAdminBooking,
  getAdminBookings,
  getAdminDashboard,
  getAdminOrders,
  getAdminSession,
  getAdminConfiguration,
  loginAdmin,
  logoutAdmin,
  saveAdminProfessionals,
  saveAdminSettings,
  setAdminSlotBlock,
} from "@/lib/admin.functions";
import {
  type AgendaBooking,
  buildIndividualAgendaMessage,
  buildProfessionalWhatsAppUrl,
  splitAgendaMessage,
} from "@/lib/agenda";
import { brl, fmtDate, STATUS_LABEL, todaySP, addDays } from "@/lib/format";
import { isValidWhatsAppNumber } from "@/lib/professionals";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel Administrativo — Lava Jato" },
      { name: "description", content: "Área administrativa do lava-jato Moto Car." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type PanelSection = "inicio" | "agendamentos" | "pedidos" | "configuracoes";
type Booking = {
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
type Slot = {
  slot_time: string;
  state: "free" | "booked" | "blocked" | "past" | "unavailable";
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
type Professional = { id: string; name: string; whatsapp: string; active: boolean };
type Settings = {
  company_name: string;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  contact_info: string | null;
};
type Dashboard = { todayCount: number; orderCount: number; upcoming: Booking[] };

const EMPTY_SETTINGS = {
  company_name: "",
  whatsapp: "",
  instagram: "",
  address: "",
  contact_info: "",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AdminPage() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [section, setSection] = useState<PanelSection>("inicio");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingDate, setBookingDate] = useState(todaySP());
  const [slotDate, setSlotDate] = useState(addDays(todaySP(), 1));
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderDate, setOrderDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(EMPTY_SETTINGS);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void getAdminSession()
      .then((result) => {
        if (!active) return;
        setConfigured(result.configured);
        setAuthenticated(result.authenticated);
        setSessionChecked(true);
      })
      .catch((error) => {
        if (!active) return;
        setPageError(errorMessage(error, "Não foi possível verificar a sessão."));
        setSessionChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setIsLoading(true);
    setPageError("");
    void Promise.all([getAdminDashboard(), getAdminConfiguration()])
      .then(([overview, configuration]) => {
        if (!active) return;
        setDashboard(overview as Dashboard);
        setSettings(configuration.settings as Settings);
        setSettingsDraft({
          company_name: configuration.settings.company_name,
          whatsapp: configuration.settings.whatsapp || "",
          instagram: configuration.settings.instagram || "",
          address: configuration.settings.address || "",
          contact_info: configuration.settings.contact_info || "",
        });
        setProfessionals(configuration.professionals);
      })
      .catch((error) => {
        if (active) setPageError(errorMessage(error, "Não foi possível carregar o painel."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || section !== "agendamentos") return;
    let active = true;
    setIsLoading(true);
    setPageError("");
    void getAdminBookings({ data: { date: bookingDate, availabilityDate: slotDate } })
      .then((result) => {
        if (!active) return;
        setBookings(result.bookings as Booking[]);
        setSlots(result.slots as Slot[]);
      })
      .catch((error) => {
        if (active) setPageError(errorMessage(error, "Não foi possível carregar os agendamentos."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated, section, bookingDate, slotDate]);

  useEffect(() => {
    if (!authenticated || section !== "pedidos") return;
    let active = true;
    setIsLoading(true);
    setPageError("");
    void getAdminOrders({
      data: {
        date: orderDate || undefined,
        status: orderStatus as
          | "all"
          | "awaiting_send"
          | "awaiting_confirmation"
          | "confirmed"
          | "completed"
          | "cancelled",
      },
    })
      .then((result) => {
        if (active) setOrders(result as AdminOrder[]);
      })
      .catch((error) => {
        if (active) setPageError(errorMessage(error, "Não foi possível carregar os pedidos."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated, section, orderDate, orderStatus]);

  const validProfessionals = useMemo(
    () =>
      professionals.filter(
        (professional) => professional.name.trim() && isValidWhatsAppNumber(professional.whatsapp),
      ),
    [professionals],
  );

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const result = await loginAdmin({ data: { password } });
      if (!result.authenticated) {
        setLoginError(
          result.rateLimited
            ? "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente."
            : "Senha incorreta. Tente novamente.",
        );
        return;
      }
      setPassword("");
      setAuthenticated(true);
      setNotice("Acesso administrativo autorizado.");
    } catch (error) {
      setLoginError(errorMessage(error, "Não foi possível validar a senha."));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    setIsSigningOut(true);
    try {
      await logoutAdmin();
      setAuthenticated(false);
      setDashboard(null);
      setBookings([]);
      setOrders([]);
      setSection("inicio");
      setNotice("Sessão encerrada.");
    } catch (error) {
      setPageError(errorMessage(error, "Não foi possível encerrar a sessão."));
    } finally {
      setIsSigningOut(false);
    }
  }

  async function refreshDashboard() {
    setIsLoading(true);
    setPageError("");
    try {
      setDashboard((await getAdminDashboard()) as Dashboard);
    } catch (error) {
      setPageError(errorMessage(error, "Não foi possível atualizar o painel."));
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmBookingCancellation() {
    if (!bookingToCancel || isCancellingBooking) return;
    const booking = bookingToCancel;
    setIsCancellingBooking(true);
    setPageError("");
    setNotice("");
    try {
      const result = await cancelAdminBooking({ data: { bookingId: booking.id } });
      setBookingToCancel(null);
      setBookings((current) =>
        current.map((item) => (item.id === booking.id ? { ...item, status: "cancelled" } : item)),
      );
      if (booking.booking_date === slotDate) {
        setSlots((current) =>
          current.map((slot) =>
            slot.slot_time === booking.slot_time ? { ...slot, state: result.slotState } : slot,
          ),
        );
      }
      const statusMessage =
        result.slotState === "free"
          ? "Agendamento desmarcado. O banco confirmou que o horário está livre."
          : result.slotState === "blocked"
            ? "Agendamento desmarcado, mas o horário continua bloqueado."
            : "Agendamento desmarcado; a disponibilidade atual não permite oferecer o horário.";
      setNotice(statusMessage);
      try {
        const refreshed = await getAdminBookings({
          data: { date: bookingDate, availabilityDate: slotDate },
        });
        setBookings(refreshed.bookings as Booking[]);
        setSlots(refreshed.slots as Slot[]);
        setDashboard((await getAdminDashboard()) as Dashboard);
      } catch (error) {
        setPageError(
          `Agendamento cancelado, mas não foi possível atualizar todos os dados do painel: ${errorMessage(error, "erro desconhecido")}`,
        );
      }
    } catch (error) {
      setPageError(errorMessage(error, "Não foi possível desmarcar o agendamento."));
    } finally {
      setIsCancellingBooking(false);
    }
  }

  async function toggleBlock(slot: Slot) {
    const blocking = slot.state !== "blocked";
    if (
      blocking &&
      !window.confirm(`Bloquear ${slot.slot_time} em ${fmtDate(slotDate)} para novos agendamentos?`)
    )
      return;
    if (!blocking && !window.confirm(`Desbloquear ${slot.slot_time} em ${fmtDate(slotDate)}?`))
      return;
    setPageError("");
    setNotice("");
    try {
      const result = await setAdminSlotBlock({
        data: { date: slotDate, slotTime: slot.slot_time, blocked: blocking },
      });
      setNotice(
        result.slotState === "blocked"
          ? "Horário bloqueado e confirmado pelo banco."
          : result.slotState === "free"
            ? "Horário desbloqueado e confirmado disponível pelo banco."
            : "A alteração foi salva, mas o horário continua indisponível.",
      );
      const refreshed = await getAdminBookings({
        data: { date: bookingDate, availabilityDate: slotDate },
      });
      setBookings(refreshed.bookings as Booking[]);
      setSlots(refreshed.slots as Slot[]);
    } catch (error) {
      setPageError(errorMessage(error, "Não foi possível atualizar o bloqueio."));
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice("");
    setPageError("");
    try {
      await saveAdminSettings({ data: settingsDraft });
      setNotice("Configurações salvas.");
      const refreshed = await getAdminConfiguration();
      setSettings(refreshed.settings as Settings);
    } catch (error) {
      setPageError(errorMessage(error, "Não foi possível salvar as configurações."));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProfessionals() {
    setIsSaving(true);
    setNotice("");
    setPageError("");
    try {
      await saveAdminProfessionals({
        data: {
          professionals: professionals.map((professional) => ({
            id: professional.id,
            name: professional.name.trim(),
            whatsapp: professional.whatsapp,
            active: professional.active,
          })),
        },
      });
      setNotice("Profissionais salvos.");
    } catch (error) {
      setPageError(errorMessage(error, "Não foi possível salvar os profissionais."));
    } finally {
      setIsSaving(false);
    }
  }

  function prepareAgendaWhatsApp() {
    const messages = splitAgendaMessage(bookingDate, bookings as unknown as AgendaBooking[]);
    const activeRecipient = validProfessionals[0];
    if (!activeRecipient) {
      setPageError("Cadastre um profissional ativo com WhatsApp válido para preparar a agenda.");
      return;
    }
    const links = messages.map((message) =>
      buildProfessionalWhatsAppUrl(activeRecipient.whatsapp, message),
    );
    if (links.some((link) => !link)) {
      setPageError("Não foi possível criar o link do WhatsApp.");
      return;
    }
    setNotice(
      messages.length > 1 ? `Agenda pronta em ${messages.length} partes.` : "Agenda pronta.",
    );
    for (const link of links) window.open(link!, "_blank", "noopener,noreferrer");
  }

  if (!sessionChecked) {
    return <LoadingScreen message="Verificando sessão administrativa..." />;
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Painel Administrativo — Lava Jato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!configured ? (
              <p className="text-sm text-destructive">
                O acesso administrativo ainda não está configurado no servidor.
              </p>
            ) : (
              <form onSubmit={submitLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Senha administrativa</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <p role="alert" className="text-sm text-destructive">
                    {loginError}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Área restrita
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Painel Administrativo — Lava Jato</h1>
        </div>
        <Button variant="outline" onClick={() => void signOut()} disabled={isSigningOut}>
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Sair
        </Button>
      </header>

      {pageError && (
        <p
          role="alert"
          className="mb-4 whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {pageError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"
        >
          {notice}
        </p>
      )}

      <nav aria-label="Seções administrativas" className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["inicio", "Início", ShieldCheck],
            ["agendamentos", "Agendamentos", CalendarDays],
            ["pedidos", "Pedidos", Package],
            ["configuracoes", "Configurações", UserRound],
          ] as const
        ).map(([key, label, Icon]) => (
          <Button
            key={key}
            variant={section === key ? "default" : "outline"}
            onClick={() => {
              setSection(key);
              setPageError("");
              setNotice("");
            }}
          >
            <Icon className="h-4 w-4" /> {label}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => void refreshDashboard()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </nav>

      {isLoading && !dashboard ? (
        <LoadingScreen message="Carregando dados administrativos..." />
      ) : section === "inicio" ? (
        <DashboardView
          dashboard={dashboard}
          onNavigate={setSection}
          onRefresh={() => void refreshDashboard()}
        />
      ) : section === "agendamentos" ? (
        <BookingsView
          date={bookingDate}
          setDate={setBookingDate}
          slotDate={slotDate}
          setSlotDate={setSlotDate}
          bookings={bookings}
          slots={slots}
          professionals={validProfessionals}
          loading={isLoading}
          onCancel={setBookingToCancel}
          onToggleBlock={(slot) => void toggleBlock(slot)}
          onPrepareWhatsApp={prepareAgendaWhatsApp}
        />
      ) : section === "pedidos" ? (
        <OrdersView
          orders={orders}
          date={orderDate}
          setDate={setOrderDate}
          status={orderStatus}
          setStatus={setOrderStatus}
          loading={isLoading}
        />
      ) : (
        <ConfigurationView
          settings={settings}
          settingsDraft={settingsDraft}
          setSettingsDraft={setSettingsDraft}
          professionals={professionals}
          setProfessionals={setProfessionals}
          loading={isLoading}
          saving={isSaving}
          onSaveSettings={(event) => void saveSettings(event)}
          onSaveProfessionals={() => void saveProfessionals()}
        />
      )}
      <AlertDialog
        open={bookingToCancel !== null}
        onOpenChange={(open) => {
          if (!open && !isCancellingBooking) setBookingToCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente cancelar este agendamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bookingToCancel && (
            <div className="space-y-1 rounded-md border bg-muted/40 p-4 text-sm">
              <p>
                <span className="font-semibold">Cliente:</span>{" "}
                {bookingToCancel.orders?.customer_name || "Não informado"}
              </p>
              <p>
                <span className="font-semibold">Data:</span> {fmtDate(bookingToCancel.booking_date)}{" "}
                às {bookingToCancel.slot_time}
              </p>
              <p>
                <span className="font-semibold">Serviço:</span>{" "}
                {bookingToCancel.orders?.items
                  .map((item) => `${item.quantity}x ${item.name}`)
                  .join(", ") || "Não informado"}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingBooking}>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void confirmBookingCancellation()}
              disabled={isCancellingBooking}
            >
              {isCancellingBooking && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-20 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> {message}
    </div>
  );
}

function DashboardView({
  dashboard,
  onNavigate,
  onRefresh,
}: {
  dashboard: Dashboard | null;
  onNavigate: (section: PanelSection) => void;
  onRefresh: () => void;
}) {
  const upcoming = dashboard?.upcoming || [];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Agendamentos de hoje</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{dashboard?.todayCount ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pedidos recebidos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{dashboard?.orderCount ?? "—"}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Próximos agendamentos</CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há próximos agendamentos.</p>
          ) : (
            upcoming.map((booking) => (
              <article
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="font-semibold">
                    {fmtDate(booking.booking_date)} · {booking.slot_time} ·{" "}
                    {booking.orders?.customer_name || "Cliente"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.orders?.items
                      .map((item) => `${item.quantity}x ${item.name}`)
                      .join(", ") || "Serviços não listados"}
                    {booking.orders?.professional_name
                      ? ` · ${booking.orders.professional_name}`
                      : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {brl(Number(booking.orders?.total || 0))}
                </span>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-auto justify-start py-4"
          onClick={() => onNavigate("agendamentos")}
        >
          <CalendarDays className="h-5 w-5" /> Abrir Agendamentos
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start py-4"
          onClick={() => onNavigate("pedidos")}
        >
          <Package className="h-5 w-5" /> Abrir Pedidos
        </Button>
      </div>
    </div>
  );
}

function BookingsView({
  date,
  setDate,
  slotDate,
  setSlotDate,
  bookings,
  slots,
  professionals,
  loading,
  onCancel,
  onToggleBlock,
  onPrepareWhatsApp,
}: {
  date: string;
  setDate: (date: string) => void;
  slotDate: string;
  setSlotDate: (date: string) => void;
  bookings: Booking[];
  slots: Slot[];
  professionals: Professional[];
  loading: boolean;
  onCancel: (booking: Booking) => void;
  onToggleBlock: (slot: Slot) => void;
  onPrepareWhatsApp: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="booking-date">Data dos agendamentos</Label>
              <Input
                id="booking-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <Button variant="outline" onClick={onPrepareWhatsApp} disabled={!professionals.length}>
              <MessageCircle className="h-4 w-4" /> Preparar agenda no WhatsApp
            </Button>
          </div>
          {loading ? (
            <LoadingScreen message="Carregando agendamentos..." />
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há registros para esta data.</p>
          ) : (
            bookings.map((booking) => {
              const order = booking.orders;
              const cancelled = booking.status !== "active" || order?.status === "cancelled";
              const agendaBooking = booking as unknown as AgendaBooking;
              const individualLink =
                order?.professional_name && order?.id
                  ? buildProfessionalWhatsAppUrl(
                      professionals.find(
                        (professional) => professional.name === order.professional_name,
                      )?.whatsapp || null,
                      buildIndividualAgendaMessage(agendaBooking),
                    )
                  : null;
              return (
                <article key={booking.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {booking.orders?.customer_name || "Cliente"} ·{" "}
                        {fmtDate(booking.booking_date)} às {booking.slot_time}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order?.items.map((item) => `${item.quantity}x ${item.name}`).join(", ") ||
                          "Serviço não informado"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Profissional: {order?.professional_name || "Não informado"} ·{" "}
                        {order?.phone || "Contato não informado"}
                      </p>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {cancelled ? "Desmarcado" : STATUS_LABEL[order?.status || ""] || "Agendado"}
                    </span>
                  </div>
                  {!cancelled && (
                    <div className="flex flex-wrap gap-2">
                      {individualLink && (
                        <a
                          href={individualLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => onCancel(booking)}>
                        Cancelar agendamento
                      </Button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloquear horários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slot-date">Data dos horários</Label>
            <Input
              id="slot-date"
              type="date"
              min={addDays(todaySP(), 1)}
              max={addDays(todaySP(), 7)}
              value={slotDate}
              onChange={(event) => setSlotDate(event.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Bloqueios e reservas são sincronizados pelo banco para evitar conflitos de horário.
          </p>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há horários na agenda para esta data.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <div
                  key={slot.slot_time}
                  className="flex items-center gap-2 rounded-md border px-2 py-1"
                >
                  <span className="text-sm">
                    {slot.slot_time} ·{" "}
                    {slot.state === "free"
                      ? "Livre"
                      : slot.state === "booked"
                        ? "Reservado"
                        : slot.state === "blocked"
                          ? "Bloqueado"
                          : "Passado"}
                  </span>
                  {(slot.state === "free" || slot.state === "blocked") && (
                    <Button size="sm" variant="outline" onClick={() => onToggleBlock(slot)}>
                      {slot.state === "blocked" ? "Desbloquear" : "Bloquear"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrdersView({
  orders,
  date,
  setDate,
  status,
  setStatus,
  loading,
}: {
  orders: AdminOrder[];
  date: string;
  setDate: (date: string) => void;
  status: string;
  setStatus: (status: string) => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="order-date">Data</Label>
            <Input
              id="order-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-status">Status</Label>
            <select
              id="order-status"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Todos</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <LoadingScreen message="Carregando pedidos..." />
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
        ) : (
          orders.map((order) => (
            <details key={order.id} className="rounded-lg border p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      Pedido #{order.code || order.id.slice(0, 8)} · {order.customer_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("pt-BR")} · {order.phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{brl(Number(order.total))}</p>
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABEL[order.status] || order.status}
                    </p>
                  </div>
                </div>
              </summary>
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                <p>
                  <b>Veículo:</b> {order.vehicle_model}
                  {order.plate ? ` · ${order.plate}` : ""}
                </p>
                <p>
                  <b>Contato:</b>{" "}
                  <a className="underline" href={`tel:${order.phone.replace(/\D/g, "")}`}>
                    {order.phone}
                  </a>
                </p>
                {order.bookings?.[0] && (
                  <p>
                    <b>Agendamento:</b> {fmtDate(order.bookings[0].booking_date)} às{" "}
                    {order.bookings[0].slot_time} · {order.bookings[0].status}
                  </p>
                )}
                <p>
                  <b>Profissional:</b> {order.professional_name || "Não informado"}
                </p>
                <p>
                  <b>Pagamento registrado:</b>{" "}
                  {order.payment_status === "paid" ? "Pago" : "Não pago"} ·{" "}
                  {brl(Number(order.paid_amount || 0))}
                </p>
                <div>
                  <b>Itens:</b>
                  <ul className="mt-1 list-inside list-disc">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.quantity}x {item.service_name} · {brl(Number(item.subtotal))}
                      </li>
                    ))}
                  </ul>
                </div>
                {order.delivery_method === "pickup" && (
                  <p>
                    <b>Endereço:</b>{" "}
                    {[order.street, order.district, order.complement, order.cep]
                      .filter(Boolean)
                      .join(", ") || "Não informado"}
                  </p>
                )}
                {order.notes && (
                  <p>
                    <b>Observações:</b> {order.notes}
                  </p>
                )}
              </div>
            </details>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ConfigurationView({
  settings,
  settingsDraft,
  setSettingsDraft,
  professionals,
  setProfessionals,
  loading,
  saving,
  onSaveSettings,
  onSaveProfessionals,
}: {
  settings: Settings | null;
  settingsDraft: typeof EMPTY_SETTINGS;
  setSettingsDraft: (settings: typeof EMPTY_SETTINGS) => void;
  professionals: Professional[];
  setProfessionals: (professionals: Professional[]) => void;
  loading: boolean;
  saving: boolean;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
  onSaveProfessionals: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Configurações da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {!settings && !loading ? (
            <p className="text-sm text-muted-foreground">Configuração não disponível.</p>
          ) : (
            <form onSubmit={onSaveSettings} className="space-y-3">
              <Field
                label="Nome"
                value={settingsDraft.company_name}
                onChange={(value) => setSettingsDraft({ ...settingsDraft, company_name: value })}
              />
              <Field
                label="WhatsApp comercial"
                value={settingsDraft.whatsapp}
                onChange={(value) => setSettingsDraft({ ...settingsDraft, whatsapp: value })}
              />
              <Field
                label="Instagram"
                value={settingsDraft.instagram}
                onChange={(value) => setSettingsDraft({ ...settingsDraft, instagram: value })}
              />
              <Field
                label="Endereço"
                value={settingsDraft.address}
                onChange={(value) => setSettingsDraft({ ...settingsDraft, address: value })}
              />
              <Field
                label="Informações de contato"
                value={settingsDraft.contact_info}
                onChange={(value) => setSettingsDraft({ ...settingsDraft, contact_info: value })}
              />
              <Button type="submit" disabled={saving || loading}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar configurações
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Profissionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {professionals.map((professional, index) => (
            <div key={professional.id} className="grid gap-3 rounded-md border p-3">
              <Field
                label="Nome"
                value={professional.name}
                onChange={(name) =>
                  setProfessionals(
                    professionals.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name } : item,
                    ),
                  )
                }
              />
              <Field
                label="WhatsApp"
                value={professional.whatsapp}
                onChange={(whatsapp) =>
                  setProfessionals(
                    professionals.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, whatsapp } : item,
                    ),
                  )
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={professional.active}
                  onChange={(event) =>
                    setProfessionals(
                      professionals.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, active: event.target.checked } : item,
                      ),
                    )
                  }
                />{" "}
                Ativo
              </label>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setProfessionals([
                ...professionals,
                { id: crypto.randomUUID(), name: "", whatsapp: "", active: true },
              ])
            }
          >
            Adicionar profissional
          </Button>
          <Button onClick={onSaveProfessionals} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar profissionais
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
