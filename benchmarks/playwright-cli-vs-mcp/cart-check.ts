// Does the shop's recorded cart hold exactly the expected items? `cart` is the shop's /__state cart: [product id,
// quantity] pairs. Product names end in 100 + (id - 1) (see fixture.ts), so "Liquid Speaker 101" is id 2.
// A product listed twice is a mismatch, never merged.
// Added after publication (code review): the published results were scored without this check and then audited with
// check-carts.ts (all passed runs match). The runners now include it in `success` for any rerun.
export function cartMatches(cart: [number, number][], items: { product: string; quantity: number }[]): boolean {
  const want = new Map(items.map((it) => [Number(String(it.product).match(/(\d+)$/)?.[1]) - 99, it.quantity]));
  const got = new Map(cart.map(([id, q]) => [id, q]));
  return got.size === cart.length && want.size === got.size && [...want].every(([id, q]) => got.get(id) === q);
}
