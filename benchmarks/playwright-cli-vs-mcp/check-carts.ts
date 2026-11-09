// Audit of the shop scoring. The runners count a run as passed when the agent's reply matches the expected items and
// total AND the shop recorded the expected number of add-to-cart events; they don't compare the recorded cart itself
// (pointed out in code review). This checks every passed shop run's recorded cart (`cart`: [product id, quantity]
// pairs from the shop's /__state) against the expected items. Product names end in 100 + (id - 1), see fixture.ts.
// Run from this folder: bun check-carts.ts
const files = (await Array.fromAsync(new Bun.Glob("results*.jsonl").scan("."))).sort();
let checked = 0, mismatched = 0;
for (const f of files) {
  const rows = (await Bun.file(f).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.run === "number");
  const shop = rows.filter((r) => r.success && Array.isArray(r.cart) && Array.isArray(r.expected?.items));
  if (!shop.length) continue;
  let bad = 0;
  for (const r of shop) {
    const want = new Map<number, number>(r.expected.items.map((it: any) => [Number(String(it.product).match(/(\d+)$/)![1]) - 99, it.quantity]));
    const got = new Map<number, number>(r.cart.map(([id, q]: [number, number]) => [id, q]));
    const duplicateIds = got.size !== r.cart.length; // a product listed twice is a mismatch, never merged
    const same = !duplicateIds && want.size === got.size && [...want].every(([id, q]) => got.get(id) === q);
    checked++;
    if (!same) { bad++; mismatched++; console.log(`  MISMATCH ${f} ${r.arm}/${r.task}/${r.variant ?? ""} run ${r.run}: cart ${JSON.stringify(r.cart)} expected ${JSON.stringify([...want])}`); }
  }
  console.log(`${f.padEnd(52)} passed shop runs ${String(shop.length).padStart(3)}  cart mismatches ${bad}`);
}
console.log(`\n${checked} passed shop runs checked; ${mismatched} with a recorded cart different from the expected items.`);
