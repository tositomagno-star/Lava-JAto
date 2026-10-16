import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Moto Car" },
      { name: "description", content: "Revise os serviços escolhidos antes de agendar." },
      { property: "og:title", content: "Carrinho — Moto Car" },
      { property: "og:description", content: "Seu carrinho de serviços Moto Car." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, total } = useCart();
  if (items.length === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-3xl">Carrinho vazio</h1>
        <p className="mt-2 text-muted-foreground">Escolha os serviços para o seu veículo.</p>
        <Link
          to="/servicos"
          className="mt-6 inline-block rounded-md bg-primary px-6 py-3 font-bold uppercase text-primary-foreground"
        >
          Ver serviços
        </Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl">Carrinho</h1>
      <ul className="mt-6 divide-y rounded-lg border bg-card">
        {items.map((i) => (
          <li key={i.service_id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{i.name}</p>
              <p className="text-sm text-muted-foreground">{brl(i.price)} cada</p>
            </div>
            <div className="flex items-center rounded-md border">
              <button
                aria-label="Diminuir"
                className="p-2 hover:text-primary"
                onClick={() => setQty(i.service_id, i.quantity - 1)}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-bold">{i.quantity}</span>
              <button
                aria-label="Aumentar"
                className="p-2 hover:text-primary"
                onClick={() => setQty(i.service_id, i.quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="w-24 text-right font-bold">{brl(i.price * i.quantity)}</p>
            <button
              aria-label="Remover"
              className="p-2 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i.service_id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between rounded-lg border bg-card p-5">
        <span className="text-lg uppercase">Total</span>
        <span className="font-display text-3xl text-primary">{brl(total)}</span>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          to="/servicos"
          className="rounded-md border px-6 py-3 text-center font-bold uppercase hover:border-primary"
        >
          Continuar escolhendo
        </Link>
        <Link
          to="/checkout"
          className="rounded-md bg-primary px-8 py-3 text-center font-bold uppercase text-primary-foreground shadow-glow"
        >
          Finalizar pedido
        </Link>
      </div>
    </div>
  );
}
