import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Droplets, ShieldCheck, Truck } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { ServiceGrid } from "./servicos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Moto Car — Seu veículo limpo, cuidado e brilhando" },
      { name: "description", content: "Lava-jato Moto Car: escolha serviços, agende data e horário e envie seu pedido pelo WhatsApp." },
      { property: "og:title", content: "Moto Car — Lava-jato" },
      { property: "og:description", content: "Agende a lavagem do seu carro, moto ou caminhonete em poucos passos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img src={hero} alt="Carro preto sendo lavado na Moto Car" width={1920} height={1088} className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="bg-hero-overlay absolute inset-0 -z-10" />
        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-20">
          <span className="mb-4 w-fit rounded-sm bg-primary px-2 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground">Lava-jato</span>
          <h1 className="max-w-2xl text-4xl leading-tight sm:text-6xl">
            Seu veículo limpo, cuidado e <span className="text-primary">brilhando!</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">Carros, motos e caminhonetes. Escolha o serviço, agende o horário e envie o pedido pelo WhatsApp.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/servicos" className="rounded-md bg-primary px-6 py-3 font-bold uppercase text-primary-foreground shadow-glow transition hover:brightness-110">
              Ver serviços
            </Link>
            <Link to="/servicos" className="flex items-center gap-2 rounded-md border border-foreground/40 px-6 py-3 font-bold uppercase hover:border-primary hover:text-primary">
              <CalendarDays className="h-5 w-5" /> Agendar lavagem
            </Link>
          </div>
        </div>
      </section>
      <div className="stripe h-1.5" />

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-3">
        {[
          { icon: Droplets, t: "Produtos de qualidade", d: "Cuidado com a pintura e o acabamento." },
          { icon: CalendarDays, t: "Agendamento online", d: "Veja os horários livres em tempo real." },
          { icon: Truck, t: "Leva ou buscamos", d: "Traga o veículo ou solicite a retirada." },
        ].map(({ icon: I, t, d }) => (
          <div key={t} className="rounded-lg border bg-card p-6">
            <I className="h-7 w-7 text-primary" />
            <p className="mt-3 text-lg font-bold">{t}</p>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-3xl">Serviços e preços</h2>
          <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4" /> Preços oficiais</span>
        </div>
        <ServiceGrid />
      </section>
    </>
  );
}
