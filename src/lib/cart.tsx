import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { mergeCartItem, type CartItem } from "./cart-utils";
export type { CartItem } from "./cart-utils";

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

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  if (
    !("service_id" in value) ||
    !("name" in value) ||
    !("price" in value) ||
    !("quantity" in value)
  ) {
    return false;
  }
  return (
    typeof value.service_id === "string" &&
    value.service_id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.price === "number" &&
    Number.isFinite(value.price) &&
    value.price >= 0 &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    value.quantity <= 50
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const stored: unknown = JSON.parse(raw);
        if (!Array.isArray(stored)) throw new TypeError("Stored cart must be an array.");
        const validItems = stored.filter(isCartItem);
        if (validItems.length !== stored.length) {
          console.error("[Cart] Ignored invalid item(s) in stored cart.");
        }
        setItems(validItems);
      }
    } catch (error) {
      console.error("[Cart] Failed to load the stored cart.", error);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (error) {
      console.error("[Cart] Failed to persist the cart.", error);
    }
  }, [items, loaded]);

  const value: Ctx = {
    items,
    add: (i) => setItems((prev) => mergeCartItem(prev, i)),
    setQty: (id, q) =>
      setItems((prev) =>
        q < 1
          ? prev.filter((p) => p.service_id !== id)
          : prev.map((p) =>
              p.service_id === id ? { ...p, quantity: Math.min(50, Math.floor(q)) } : p,
            ),
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
