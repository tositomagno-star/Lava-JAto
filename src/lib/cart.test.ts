import { describe, expect, it } from "vitest";
import { mergeCartItem, syncCartPrices, type CartItem } from "./cart-utils";

describe("cart item merging", () => {
  it("refreshes the current catalog name and price while incrementing quantity", () => {
    const cart: CartItem[] = [
      { service_id: "service-1", name: "Old name", price: 20, quantity: 2 },
    ];

    expect(
      mergeCartItem(cart, { service_id: "service-1", name: "Current name", price: 25 }),
    ).toEqual([{ service_id: "service-1", name: "Current name", price: 25, quantity: 3 }]);
  });

  describe("cart catalog price synchronization", () => {
    it("updates saved cart names and prices from the current catalog without changing quantity", () => {
      const cart: CartItem[] = [
        { service_id: "moto", name: "Motocicleta", price: 40, quantity: 2 },
        { service_id: "car", name: "Lavagem simples", price: 40, quantity: 1 },
      ];

      expect(
        syncCartPrices(cart, [
          { service_id: "moto", name: "Motocicleta", price: 50 },
          { service_id: "car", name: "Lavagem simples", price: 40 },
        ]),
      ).toEqual([
        { service_id: "moto", name: "Motocicleta", price: 50, quantity: 2 },
        { service_id: "car", name: "Lavagem simples", price: 40, quantity: 1 },
      ]);
    });

    it("keeps unknown services unchanged and preserves array identity when no price changes", () => {
      const cart: CartItem[] = [
        { service_id: "legacy", name: "Serviço antigo", price: 35, quantity: 1 },
      ];

      expect(syncCartPrices(cart, [])).toBe(cart);
      expect(
        syncCartPrices(cart, [{ service_id: "legacy", name: "Serviço antigo", price: 35 }]),
      ).toBe(cart);
    });
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
