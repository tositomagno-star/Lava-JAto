export type CartItem = {
  service_id: string;
  name: string;
  price: number;
  quantity: number;
};

export function mergeCartItem(items: CartItem[], item: Omit<CartItem, "quantity">): CartItem[] {
  const existing = items.find((current) => current.service_id === item.service_id);
  if (!existing) return [...items, { ...item, quantity: 1 }];

  return items.map((current) =>
    current.service_id === item.service_id
      ? { ...current, ...item, quantity: Math.min(50, current.quantity + 1) }
      : current,
  );
}
