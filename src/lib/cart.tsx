import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = { service_id: string; name: string; price: number; quantity: number };

export function cartTotal(items: CartItem[]) {
  return Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
}

type Ctx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "quantity">) => void;
  setQty: (id: string, q: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "motocar-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, loaded]);

  const value: Ctx = {
    items,
    add: (i) =>
      setItems((prev) => {
        const ex = prev.find((p) => p.service_id === i.service_id);
        if (ex) return prev.map((p) => (p.service_id === i.service_id ? { ...p, quantity: Math.min(50, p.quantity + 1) } : p));
        return [...prev, { ...i, quantity: 1 }];
      }),
    setQty: (id, q) =>
      setItems((prev) =>
        q < 1 ? prev.filter((p) => p.service_id !== id) : prev.map((p) => (p.service_id === id ? { ...p, quantity: Math.min(50, Math.floor(q)) } : p)),
      ),
    remove: (id) => setItems((prev) => prev.filter((p) => p.service_id !== id)),
    clear: () => setItems([]),
    total: cartTotal(items),
    count: items.reduce((s, i) => s + i.quantity, 0),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
