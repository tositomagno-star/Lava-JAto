import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { mergeCartItem, type ArrivalMethod, type CartItem, type ReturnMethod } from "./cart-utils";
export type { CartItem } from "./cart-utils";

export function cartTotal(items: CartItem[]) {
  return Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
}

type Ctx = {
  items: CartItem[];
  arrivalMethod: ArrivalMethod | null;
  returnMethod: ReturnMethod | null;
  setArrivalMethod: (method: ArrivalMethod) => void;
  setReturnMethod: (method: ReturnMethod) => void;
  add: (i: Omit<CartItem, "quantity">) => void;
  setQty: (id: string, q: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "motocar-cart-v1";
const DELIVERY_KEY = "motocar-cart-delivery-v1";

function isDeliveryChoices(
  value: unknown,
): value is { arrivalMethod: ArrivalMethod | null; returnMethod: ReturnMethod | null } {
  if (typeof value !== "object" || value === null) return false;
  const choices = value as Record<string, unknown>;
  return (
    (choices["arrivalMethod"] === null ||
      choices["arrivalMethod"] === "dropoff" ||
      choices["arrivalMethod"] === "pickup") &&
    (choices["returnMethod"] === null ||
      choices["returnMethod"] === "customer_pickup" ||
      choices["returnMethod"] === "delivery")
  );
}

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
  const [arrivalMethod, setArrivalMethod] = useState<ArrivalMethod | null>(null);
  const [returnMethod, setReturnMethod] = useState<ReturnMethod | null>(null);
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
    try {
      const rawChoices = localStorage.getItem(DELIVERY_KEY);
      if (rawChoices) {
        const choices: unknown = JSON.parse(rawChoices);
        if (isDeliveryChoices(choices)) {
          setArrivalMethod(choices.arrivalMethod);
          setReturnMethod(choices.returnMethod);
        } else {
          console.error("[Cart] Ignored invalid stored delivery choices.");
        }
      }
    } catch (error) {
      console.error("[Cart] Failed to load the stored delivery choices.", error);
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
  useEffect(() => {
    if (!loaded) return;
    try {
      if (arrivalMethod === null && returnMethod === null) {
        localStorage.removeItem(DELIVERY_KEY);
      } else {
        localStorage.setItem(DELIVERY_KEY, JSON.stringify({ arrivalMethod, returnMethod }));
      }
    } catch (error) {
      console.error("[Cart] Failed to persist the delivery choices.", error);
    }
  }, [arrivalMethod, returnMethod, loaded]);
  const value: Ctx = {
    items,
    arrivalMethod,
    returnMethod,
    setArrivalMethod,
    setReturnMethod,
    add: (i) => setItems((prev) => mergeCartItem(prev, i)),
    setQty: (id, q) => {
      if (q < 1 && items.length === 1 && items[0]?.service_id === id) {
        setArrivalMethod(null);
        setReturnMethod(null);
      }
      setItems((prev) =>
        q < 1
          ? prev.filter((p) => p.service_id !== id)
          : prev.map((p) =>
              p.service_id === id ? { ...p, quantity: Math.min(50, Math.floor(q)) } : p,
            ),
      );
    },
    remove: (id) => {
      if (items.length === 1 && items[0]?.service_id === id) {
        setArrivalMethod(null);
        setReturnMethod(null);
      }
      setItems((prev) => prev.filter((p) => p.service_id !== id));
    },
    clear: () => {
      setItems([]);
      setArrivalMethod(null);
      setReturnMethod(null);
    },
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
