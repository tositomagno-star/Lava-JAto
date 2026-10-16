import { describe, expect, it } from "vitest";
import { mergeCartItem, type CartItem } from "./cart-utils";

describe("cart item merging", () => {
  it("refreshes the current catalog name and price while incrementing quantity", () => {
    const cart: CartItem[] = [
      { service_id: "service-1", name: "Old name", price: 20, quantity: 2 },
    ];

    expect(
      mergeCartItem(cart, { service_id: "service-1", name: "Current name", price: 25 }),
    ).toEqual([{ service_id: "service-1", name: "Current name", price: 25, quantity: 3 }]);
  });

  it("keeps the existing quantity limit when adding an item", () => {
    const cart: CartItem[] = [
      { service_id: "service-1", name: "Service", price: 20, quantity: 50 },
    ];

    expect(mergeCartItem(cart, { service_id: "service-1", name: "Service", price: 20 })).toEqual(
      cart,
    );
  });
});
