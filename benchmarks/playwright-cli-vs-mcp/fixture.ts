// Deterministic page-heavy shop fixture. No network requests, no external assets, seeded catalogue.
const ADJ = ["Liquid", "Solid", "Brushed", "Matte", "Polished", "Woven", "Recycled", "Compact", "Heavy", "Light"];
const NOUN = ["Lantern", "Backpack", "Kettle", "Notebook", "Speaker", "Desk Mat", "Thermos", "Headset", "Keyboard", "Monitor Arm"];
const products = Array.from({ length: Number(process.env.PRODUCTS ?? 400) }, (_, i) => ({
  id: i + 1,
  name: `${ADJ[(i * 7 + 3) % ADJ.length]} ${NOUN[(i * 3 + 1) % NOUN.length]} ${100 + i}`,
  cents: 1999 + ((i * 137) % 8000),
  rating: (30 + ((i * 11) % 21)) / 10,
  blurb: `Item ${100 + i} ships in ${1 + (i % 9)} days. Rated by ${50 + i * 3} buyers. Includes a ${1 + (i % 5)} year warranty and free returns within ${14 + (i % 30)} days.`,
}));
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const cart = new Map<number, number>();
let addEvents = 0;
let nonBrowserRequests = 0;

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body>
<header><a href="/">Bench Shop</a> <nav aria-label="Departments">${NOUN.map((n) => `<a href="/?q=${encodeURIComponent(n)}">${n}</a>`).join(" ")}</nav> <a href="/cart">Cart</a></header>
<main>${body}</main>
<footer><nav aria-label="Footer">${Array.from({ length: 60 }, (_, i) => `<a href="/?q=help-${i}">Help topic ${i + 1}</a>`).join(" ")}</nav></footer></body></html>`;

const server = Bun.serve({
  port: Number(process.env.PORT ?? 0),
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== "/__state" && !/Chrome/.test(req.headers.get("user-agent") ?? "")) nonBrowserRequests++;
    const html = (s: string) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const list = products.filter((p) => p.name.toLowerCase().includes(q));
      return html(shell("Bench Shop", `<h1>Products</h1><form action="/" role="search"><label>Search <input name="q" value="${q}"></label> <button>Search</button></form>
<p>${list.length} results</p><ul>${list.map((p) => `<li><h2><a href="/product/${p.id}">${p.name}</a></h2><p>${money(p.cents)}. Rated ${p.rating} of 5.</p><p>${p.blurb}</p></li>`).join("")}</ul>`));
    }
    const m = url.pathname.match(/^\/product\/(\d+)$/);
    if (m) {
      const p = products[Number(m[1]) - 1];
      if (!p) return new Response("Not found", { status: 404 });
      return html(shell(p.name, `<h1>${p.name}</h1><p>${money(p.cents)}</p><p>${p.blurb}</p><form method="post" action="/cart/add"><input type="hidden" name="id" value="${p.id}"><label>Quantity <input name="quantity" type="number" min="1" value="1"></label> <button>Add to cart</button></form>`));
    }
    if (url.pathname === "/cart/add" && req.method === "POST") {
      const f = await req.formData();
      const id = Number(f.get("id"));
      cart.set(id, (cart.get(id) ?? 0) + Number(f.get("quantity") ?? 1));
      addEvents++;
      return Response.redirect("/cart", 303);
    }
    if (url.pathname === "/cart") {
      const rows = [...cart].map(([id, qty]) => ({ p: products[id - 1], qty }));
      const total = rows.reduce((s, r) => s + r.p.cents * r.qty, 0);
      return html(shell("Cart", `<h1>Cart</h1><ul>${rows.map((r) => `<li>${r.p.name}, quantity ${r.qty}, ${money(r.p.cents * r.qty)}</li>`).join("")}</ul><p>Total: ${money(total)}</p>`));
    }
    if (url.pathname === "/__state") return Response.json({ nonBrowserRequests, addEvents, cart: [...cart], totalCents: [...cart].reduce((s, [id, q]) => s + products[id - 1].cents * q, 0) });
    return new Response("Not found", { status: 404 });
  },
});
const firstFor = (q: string) => products.find((p) => p.name.toLowerCase().includes(q.toLowerCase()))!;
const plan: [string, number][] = JSON.parse(process.env.PLAN ?? "[]");
const items = plan.map(([q, quantity]) => ({ product: firstFor(q).name, quantity }));
const total = plan.reduce((sum, [q, n]) => sum + firstFor(q).cents * n, 0);
console.log(JSON.stringify({ port: server.port, expected: { items, total: money(total), adds: plan.length } }));
