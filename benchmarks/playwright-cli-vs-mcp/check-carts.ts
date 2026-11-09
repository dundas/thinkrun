// Audit of the published shop scoring. When these results were recorded, a run passed when the agent's reply matched
// the expected items and total AND the shop recorded the expected number of add-to-cart events; the recorded cart
// itself wasn't compared (pointed out in code review, then added to the runners via cart-check.ts). This checks every
// passed run's recorded cart (`cart`: [product id, quantity] pairs from the shop's /__state) against the expected items.
// Run from this folder: bun check-carts.ts
import { cartMatches } from "./cart-check";
const files = (await Array.fromAsync(new Bun.Glob("results*.jsonl").scan("."))).sort();
let checked = 0, mismatched = 0;
for (const f of files) {
  const rows = (await Bun.file(f).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.run === "number");
  const shop = rows.filter((r) => r.success && Array.isArray(r.cart) && Array.isArray(r.expected?.items));
  if (!shop.length) continue;
  let bad = 0;
  for (const r of shop) {
    const same = cartMatches(r.cart, r.expected.items);
    checked++;
    if (!same) { bad++; mismatched++; console.log(`  MISMATCH ${f} ${r.arm}/${r.task}/${r.variant ?? ""} run ${r.run}: cart ${JSON.stringify(r.cart)} expected ${JSON.stringify(r.expected.items)}`); }
  }
  console.log(`${f.padEnd(52)} passed shop runs ${String(shop.length).padStart(3)}  cart mismatches ${bad}`);
}
console.log(`\n${checked} passed shop runs checked; ${mismatched} with a recorded cart different from the expected items.`);
