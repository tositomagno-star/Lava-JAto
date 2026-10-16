export type CartItem = {
  service_id: string;
  name: string;
  price: number;
  quantity: number;
};

export type CatalogItem = Pick<CartItem, "service_id" | "name" | "price">;

export type ArrivalMethod = "dropoff" | "pickup";
export type ReturnMethod = "customer_pickup" | "delivery";

export function syncCartPrices(items: CartItem[], catalog: CatalogItem[]) {
  const catalogById = new Map(catalog.map((item) => [item.service_id, item]));
  let changed = false;
  const syncedItems = items.map((item) => {
    const current = catalogById.get(item.service_id);
    if (!current || (current.name === item.name && current.price === item.price)) return item;
    changed = true;
    return { ...item, name: current.name, price: current.price };
  });
  return changed ? syncedItems : items;
}

export function hasRequiredDeliveryChoices(
  arrivalMethod: ArrivalMethod | null,
  returnMethod: ReturnMethod | null,
) {
  return arrivalMethod !== null && returnMethod !== null;
}

export function mergeCartItem(items: CartItem[], item: Omit<CartItem, "quantity">): CartItem[] {
  const existing = items.find((current) => current.service_id === item.service_id);
  if (!existing) return [...items, { ...item, quantity: 1 }];

  return items.map((current) =>
    current.service_id === item.service_id
      ? { ...current, ...item, quantity: Math.min(50, current.quantity + 1) }
      : current,
  );
}
