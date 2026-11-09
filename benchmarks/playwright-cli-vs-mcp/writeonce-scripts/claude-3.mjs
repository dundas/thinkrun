import { chromium } from "playwright";

const base = process.argv[2];
const plan = [
  ["Lantern", 1], ["Backpack", 2], ["Kettle", 1], ["Notebook", 3],
  ["Speaker", 1], ["Thermos", 2], ["Headset", 1], ["Keyboard", 2],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const items = [];
  for (const [term, qty] of plan) {
    await page.goto(base);
    await page.getByRole("search").getByRole("textbox").fill(term);
    await page.getByRole("search").getByRole("button").click();
    await page.waitForURL(/[?&]q=/);
    await page.locator("main ul li h2 a").first().click();
    await page.waitForURL(/\/product\//);
    const product = (await page.locator("main h1").innerText()).trim();
    await page.getByLabel("Quantity").fill(String(qty));
    await Promise.all([
      page.waitForLoadState("load"),
      page.getByRole("button", { name: "Add to cart" }).click(),
    ]);
    items.push({ product, quantity: qty });
  }
  await page.goto(new URL("/cart", base).href);
  const text = (await page.locator("main p", { hasText: "Total" }).first().innerText()).trim();
  const total = text.replace(/^Total:\s*/i, "");
  console.log(JSON.stringify({ items, total }));
} finally {
  await browser.close();
}
