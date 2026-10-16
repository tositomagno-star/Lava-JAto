import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { serviceImage, useServices } from "@/lib/data";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços e preços — Moto Car" },
      {
        name: "description",
        content:
          "Ducha, lavagem de moto, externa, interna e completa. Confira os preços da Moto Car.",
      },
      { property: "og:title", content: "Serviços e preços — Moto Car" },
      {
        property: "og:description",
        content: "Todos os serviços do lava-jato Moto Car com preços.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { count, total } = useCart();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">Serviços</h1>
      <p className="mt-2 text-muted-foreground">
        Adicione um ou mais serviços ao carrinho e depois escolha data e horário.
      </p>
      <div className="mt-8">
        <ServiceGrid />
      </div>
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="text-sm">
              <b>{count}</b> item(ns) · <b className="text-primary">{brl(total)}</b>
            </span>
            <Link
              to="/carrinho"
              className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-bold uppercase text-primary-foreground"
            >
              <ShoppingCart className="h-4 w-4" /> Ver carrinho
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiceGrid() {
  const { data, isLoading, error } = useServices();
  const { add } = useCart();
  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (error) return <p className="text-destructive">Não foi possível carregar os serviços.</p>;
  if (!data?.length)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Nenhum serviço disponível no momento.
      </p>
    );
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data?.map((s) => (
        <article
          key={s.id}
          className="group flex flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={serviceImage(s)}
              alt={s.name}
              loading="lazy"
              width={944}
              height={704}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <span className="absolute bottom-3 left-3 rounded-md bg-primary px-3 py-1 font-display text-lg text-primary-foreground">
              {brl(Number(s.price))}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <h3 className="text-lg leading-snug">{s.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.description}</p>
            <button
              onClick={() => {
                add({ service_id: s.id, name: s.name, price: Number(s.price) });
                toast.success(`${s.name} adicionado ao carrinho`);
              }}
              className="mt-4 flex items-center justify-center gap-2 rounded-md bg-secondary py-2.5 font-bold uppercase transition hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Adicionar ao carrinho
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
