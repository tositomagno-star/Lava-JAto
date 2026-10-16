import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/data";
import { onlyDigits, REGION } from "@/lib/format";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary font-display text-lg text-primary-foreground">
        M
      </span>
      <span className="font-display text-xl tracking-tight">
        MOTO<span className="text-primary">CAR</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-semibold uppercase sm:gap-4">
          <Link
            to="/servicos"
            className="px-2 py-1 hover:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            Serviços
          </Link>
          <Link
            to="/carrinho"
            className="relative flex items-center gap-1 rounded-md bg-secondary px-3 py-2 hover:bg-accent"
            aria-label="Carrinho"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {count > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { data: s } = useSettings();
  return (
    <footer className="mt-20 border-t">
      <div className="stripe h-1.5" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Lava-jato para carros, motos e caminhonetes.
          </p>
          <p className="text-sm text-muted-foreground">{REGION} · Horário de Brasília</p>
          {s?.address && <p className="text-sm text-muted-foreground">{s.address}</p>}
          {s?.contact_info && <p className="text-sm text-muted-foreground">{s.contact_info}</p>}
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold uppercase">Horários</p>
          <p className="text-muted-foreground">Seg a Qui: 08:00 às 16:30</p>
          <p className="text-muted-foreground">Sex e Sáb: 08:00 às 17:00</p>
          <p className="text-muted-foreground">Domingo: fechado</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold uppercase">Contato</p>
          {s?.whatsapp ? (
            <a
              className="flex items-center gap-2 hover:text-primary"
              href={`https://wa.me/${onlyDigits(s.whatsapp)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="h-4 w-4" /> WhatsApp em breve
            </span>
          )}
          {s?.instagram ? (
            <a
              className="flex items-center gap-2 hover:text-primary"
              href={s.instagram}
              target="_blank"
              rel="noreferrer"
            >
              <Instagram className="h-4 w-4" /> Instagram
            </a>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Instagram className="h-4 w-4" /> Instagram em breve
            </span>
          )}
          <Link to="/admin" className="mt-4 text-xs text-muted-foreground hover:text-foreground">
            Área administrativa
          </Link>
        </div>
      </div>
    </footer>
  );
}
