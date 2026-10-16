import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Loader2,
  MapPinned,
  MessageCircle,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { useAvailability, useProfessionals, useSettings } from "@/lib/data";
import { bookingWindow } from "@/lib/agenda";
import {
  buildWhatsAppMessage,
  brl,
  fmtDate,
  todaySP,
  weekdayShort,
  type OrderSummary,
} from "@/lib/format";
import {
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
  professionalWhatsAppUrl,
} from "@/lib/professionals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const emptyForm = {
  customer_name: "",
  phone: "",
  vehicle_model: "",
  plate: "",
  booking_date: "",
  slot_time: "",
  delivery_method: "dropoff" as "dropoff" | "pickup",
  cep: "",
  street: "",
  district: "",
  complement: "",
  reference: "",
  notes: "",
};

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pedido — Moto Car" },
      { name: "description", content: "Informe seus dados e escolha data e horário." },
      { property: "og:title", content: "Finalizar pedido — Moto Car" },
      { property: "og:description", content: "Checkout do lava-jato Moto Car." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { data: settings } = useSettings();
  const [form, setForm] = useState(emptyForm);
  const [validDates, setValidDates] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<"details" | "review">("details");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: professionals = [], error: professionalsError } = useProfessionals();
  const {
    data: availability = [],
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAvailability(form.booking_date);

  useEffect(() => {
    const refreshToday = () => {
      const nextWindow = bookingWindow(todaySP());
      setValidDates(nextWindow);
      setForm((current) => ({
        ...current,
        booking_date: nextWindow.includes(current.booking_date)
          ? current.booking_date
          : nextWindow[0] || "",
      }));
    };

    refreshToday();
    const interval = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      professionals.length &&
      !professionals.some((professional) => professional.id === selectedProfessionalId)
    ) {
      const first = professionals.find((professional) => isValidWhatsAppNumber(professional.phone));
      setSelectedProfessionalId(first?.id || "");
    }
  }, [professionals, selectedProfessionalId]);

  useEffect(() => {
    if (!form.slot_time) return;

    const slotStillAvailable = availability.some(
      (slot) => slot.slot_time === form.slot_time && slot.state === "free",
    );
    if (!slotStillAvailable) setForm((current) => ({ ...current, slot_time: "" }));
  }, [availability, form.slot_time]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl">Carrinho vazio</h1>
        <p className="mt-2 text-muted-foreground">Adicione serviços para finalizar o pedido.</p>
        <Link
          to="/servicos"
          className="mt-6 inline-block rounded-md bg-primary px-6 py-3 font-bold uppercase text-primary-foreground"
        >
          Ver serviços
        </Link>
      </div>
    );
  }

  const cartRows = items.map((item) => ({
    ...item,
    subtotal: item.price * item.quantity,
  }));

  const selectedProfessional =
    professionals.find((professional) => professional.id === selectedProfessionalId) || null;
  const activeProfessionals = professionals;

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const nextErrors: string[] = [];

    if (!form.customer_name.trim()) nextErrors.push("Informe o nome do cliente.");
    if (!form.phone.trim()) nextErrors.push("Informe o telefone.");
    if (!form.vehicle_model.trim()) nextErrors.push("Informe o modelo do veículo.");
    if (!form.booking_date) nextErrors.push("Selecione a data do agendamento.");
    else if (!validDates.includes(form.booking_date))
      nextErrors.push("Escolha uma data entre amanhã e os próximos 7 dias.");
    if (!form.slot_time) nextErrors.push("Selecione um horário disponível.");
    if (
      !selectedProfessional ||
      !selectedProfessional.active ||
      !isValidWhatsAppNumber(selectedProfessional.phone)
    ) {
      nextErrors.push("Selecione um profissional com WhatsApp configurado.");
    }
    if (form.delivery_method === "pickup") {
      if (!form.street.trim() || !form.district.trim())
        nextErrors.push("Informe rua e bairro para a retirada.");
    }

    return nextErrors;
  }

  async function handleReview() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setStep("review");
  }

  async function handleConfirm() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    if (
      !selectedProfessional ||
      !selectedProfessional.active ||
      !isValidWhatsAppNumber(selectedProfessional.phone)
    ) {
      toast.error("Selecione um profissional com número de WhatsApp válido.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: availabilityData, error: availabilityError } = await supabase.rpc(
        "get_availability",
        { _date: form.booking_date },
      );
      if (availabilityError) throw availabilityError;

      const currentSlot = availabilityData?.find(
        (slot: { slot_time: string; state: string }) => slot.slot_time === form.slot_time,
      );
      if (!currentSlot || currentSlot.state !== "free") {
        throw new Error("Este horário não está mais disponível. Escolha outro.");
      }

      const payload = {
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        vehicle_model: form.vehicle_model.trim(),
        plate: form.plate.trim() || null,
        date: form.booking_date,
        time: form.slot_time,
        delivery_method: form.delivery_method,
        cep: form.delivery_method === "pickup" ? form.cep.trim() || null : null,
        street: form.delivery_method === "pickup" ? form.street.trim() || null : null,
        district: form.delivery_method === "pickup" ? form.district.trim() || null : null,
        complement: form.delivery_method === "pickup" ? form.complement.trim() || null : null,
        reference: form.delivery_method === "pickup" ? form.reference.trim() || null : null,
        notes: form.notes.trim() || null,
        items: items.map((item) => ({ service_id: item.service_id, quantity: item.quantity })),
      };

      const professionalPhone = normalizeWhatsAppNumber(selectedProfessional.phone);
      const { data, error } = await supabase.rpc("create_order_with_professional", {
        _payload: payload,
        _professional_name: selectedProfessional.name,
        _professional_phone: professionalPhone,
      });
      if (error) throw error;

      const order = data as { code?: string; id?: string } | null;
      if (!order?.id)
        throw new Error("O pedido foi criado, mas não foi possível obter o código para confirmar.");

      const { data: orderSummaryData, error: summaryError } = await supabase.rpc(
        "get_order_summary",
        { _id: order.id },
      );
      if (summaryError) throw summaryError;
      if (
        !orderSummaryData ||
        typeof orderSummaryData !== "object" ||
        Array.isArray(orderSummaryData)
      ) {
        throw new Error("O pedido foi criado, mas não foi possível carregar o resumo oficial.");
      }

      const summary = orderSummaryData as OrderSummary;
      if (
        !summary.professional_name ||
        !summary.professional_phone ||
        !isValidWhatsAppNumber(summary.professional_phone)
      ) {
        throw new Error(
          "O pedido foi criado, mas o profissional salvo não tem um WhatsApp válido.",
        );
      }

      const message = buildWhatsAppMessage(summary);
      const link = professionalWhatsAppUrl(
        {
          ...selectedProfessional,
          name: summary.professional_name,
          phone: summary.professional_phone,
        },
        message,
      );
      if (!link)
        throw new Error("O WhatsApp do profissional selecionado não está ativo ou configurado.");
      window.open(link, "_blank", "noopener,noreferrer");
      clear();
      toast.success("Pedido criado. Abra o WhatsApp e toque em Enviar para concluir.");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Não foi possível confirmar o pedido agora.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Checkout</p>
          <h1 className="mt-2 text-4xl">Finalizar pedido</h1>
        </div>
        <Link
          to="/carrinho"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar ao carrinho
        </Link>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={error} className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4" /> <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-6">
          {step === "details" ? (
            <Card>
              <CardHeader>
                <CardTitle>Dados do cliente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customer_name">Nome</Label>
                  <Input
                    id="customer_name"
                    value={form.customer_name}
                    onChange={(event) => updateField("customer_name", event.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_model">Modelo do veículo</Label>
                  <Input
                    id="vehicle_model"
                    value={form.vehicle_model}
                    onChange={(event) => updateField("vehicle_model", event.target.value)}
                    placeholder="Honda CG 160"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="plate">Placa (opcional)</Label>
                  <Input
                    id="plate"
                    value={form.plate}
                    onChange={(event) => updateField("plate", event.target.value)}
                    placeholder="ABC1D23"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booking_date">Data do agendamento</Label>
                  <select
                    id="booking_date"
                    value={form.booking_date}
                    onChange={(event) => updateField("booking_date", event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {validDates.map((date) => (
                      <option key={date} value={date}>
                        {weekdayShort(date)}, {fmtDate(date)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slot_time">Horário disponível</Label>
                  {availabilityError && (
                    <p className="text-sm text-destructive">
                      Não foi possível carregar os horários:{" "}
                      {availabilityError instanceof Error
                        ? availabilityError.message
                        : "erro desconhecido"}
                    </p>
                  )}
                  <select
                    id="slot_time"
                    value={form.slot_time}
                    onChange={(event) => updateField("slot_time", event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecione um horário</option>
                    {availabilityLoading ? (
                      <option value="" disabled>
                        Carregando horários...
                      </option>
                    ) : (
                      availability.map((slot) => (
                        <option
                          key={slot.slot_time}
                          value={slot.slot_time}
                          disabled={slot.state !== "free"}
                        >
                          {slot.slot_time}{" "}
                          {slot.state === "free"
                            ? "- disponível"
                            : slot.state === "past"
                              ? "- passado"
                              : slot.state === "blocked"
                                ? "- indisponível"
                                : "- reservado"}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Como você vai entregar o veículo?</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateField("delivery_method", "dropoff")}
                      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-semibold ${form.delivery_method === "dropoff" ? "border-primary bg-primary/5 text-primary" : "border-input bg-background"}`}
                    >
                      <Truck className="h-4 w-4" /> Vou levar até a Moto Car
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField("delivery_method", "pickup")}
                      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-semibold ${form.delivery_method === "pickup" ? "border-primary bg-primary/5 text-primary" : "border-input bg-background"}`}
                    >
                      <MapPinned className="h-4 w-4" /> Quero solicitar a retirada
                    </button>
                  </div>
                </div>

                {form.delivery_method === "pickup" && (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="street">Endereço completo</Label>
                      <Input
                        id="street"
                        value={form.street}
                        onChange={(event) => updateField("street", event.target.value)}
                        placeholder="Rua, número, complemento"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="district">Bairro</Label>
                      <Input
                        id="district"
                        value={form.district}
                        onChange={(event) => updateField("district", event.target.value)}
                        placeholder="Centro"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={form.cep}
                        onChange={(event) => updateField("cep", event.target.value)}
                        placeholder="00000-000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        value={form.complement}
                        onChange={(event) => updateField("complement", event.target.value)}
                        placeholder="Casa, apartamento, referência"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="reference">Ponto de referência</Label>
                      <Input
                        id="reference"
                        value={form.reference}
                        onChange={(event) => updateField("reference", event.target.value)}
                        placeholder="Próximo ao posto de gasolina"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder="Descreva qualquer detalhe relevante."
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Resumo do pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Cliente
                  </p>
                  <p className="mt-2 font-semibold">{form.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{form.phone}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Veículo
                    </p>
                    <p className="mt-2 font-semibold">{form.vehicle_model}</p>
                    <p className="text-sm text-muted-foreground">
                      Placa: {form.plate || "Não informada"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Agendamento
                    </p>
                    <p className="mt-2 font-semibold">{fmtDate(form.booking_date)}</p>
                    <p className="text-sm text-muted-foreground">{form.slot_time}</p>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Entrega
                  </p>
                  <p className="mt-2 font-semibold">
                    {form.delivery_method === "dropoff"
                      ? "Vou levar até a Moto Car"
                      : "Solicito retirada"}
                  </p>
                  {form.delivery_method === "pickup" && (
                    <p className="text-sm text-muted-foreground">
                      {[form.street, form.district, form.complement].filter(Boolean).join(" · ") ||
                        "Endereço não informado"}
                    </p>
                  )}
                </div>

                <div className="rounded-md border bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Profissional
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-semibold">
                    <MessageCircle className="h-4 w-4 text-primary" />{" "}
                    {selectedProfessional?.name || "Não selecionado"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    WhatsApp:{" "}
                    {selectedProfessional?.phone ? selectedProfessional.phone : "Não configurado"}
                  </p>
                </div>

                <div className="space-y-3">
                  {cartRows.map((item) => (
                    <div
                      key={item.service_id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div>
                        <p className="font-semibold">
                          {item.quantity}x {item.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{brl(item.price)} cada</p>
                      </div>
                      <p className="font-semibold">{brl(item.subtotal)}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{brl(total)}</span>
                  </div>
                  {form.delivery_method === "pickup" && Number(settings?.pickup_fee || 0) > 0 && (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span>Retirada</span>
                      <span>{brl(Number(settings?.pickup_fee || 0))}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">
                      {brl(
                        Number(total) +
                          (form.delivery_method === "pickup"
                            ? Number(settings?.pickup_fee || 0)
                            : 0),
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Quem vai realizar o seu serviço?</CardTitle>
            </CardHeader>
            <CardContent>
              {professionalsError ? (
                <p className="text-sm text-destructive">
                  Não foi possível carregar os profissionais do cadastro compartilhado:{" "}
                  {professionalsError instanceof Error
                    ? professionalsError.message
                    : "erro desconhecido"}
                </p>
              ) : activeProfessionals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum profissional ativo disponível no momento.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {activeProfessionals.map((professional) => {
                    const valid = isValidWhatsAppNumber(professional.phone);
                    const selected = professional.id === selectedProfessionalId;

                    return (
                      <button
                        key={professional.id}
                        type="button"
                        onClick={() => setSelectedProfessionalId(professional.id)}
                        className={`rounded-lg border p-4 text-left transition ${selected ? "border-primary bg-primary/5" : "border-input bg-card hover:border-primary/50"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{professional.name}</p>
                            <p
                              className={`mt-1 text-sm ${valid ? "text-muted-foreground" : "text-destructive"}`}
                            >
                              {valid ? "WhatsApp configurado" : "Número não configurado"}
                            </p>
                          </div>
                          <div
                            className={`grid h-10 w-10 place-items-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                          >
                            <MessageCircle className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {valid ? professional.phone : "Aguardando configuração"}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                          >
                            {selected ? "Selecionado" : "Selecionar"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cartRows.map((item) => (
                <div key={item.service_id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity}x · {brl(item.price)}
                    </p>
                  </div>
                  <p className="font-semibold">{brl(item.subtotal)}</p>
                </div>
              ))}
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{brl(total)}</span>
                </div>
                {form.delivery_method === "pickup" && Number(settings?.pickup_fee || 0) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>Retirada</span>
                    <span>{brl(Number(settings?.pickup_fee || 0))}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    {brl(
                      Number(total) +
                        (form.delivery_method === "pickup" ? Number(settings?.pickup_fee || 0) : 0),
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conclusão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {step === "details" ? (
                <Button onClick={handleReview} className="w-full">
                  Continuar para revisão
                </Button>
              ) : (
                <>
                  <Button onClick={handleConfirm} className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                      </>
                    ) : (
                      "Confirmar pedido"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("details")} className="w-full">
                    Voltar e editar
                  </Button>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Ao confirmar, o pedido será salvo e o WhatsApp do profissional escolhido será aberto
                com a mensagem pronta.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
