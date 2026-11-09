import { chromium } from "playwright";

const url = process.argv[2];
if (!url) throw new Error("Usage: node shop.mjs <shop url>");

const requests = [
  ["Lantern", 1],
  ["Backpack", 2],
  ["Kettle", 1],
  ["Notebook", 3],
  ["Speaker", 1],
  ["Thermos", 2],
  ["Headset", 1],
  ["Keyboard", 2],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(url);
  const items = [];

  for (const [term, quantity] of requests) {
    await page.goto(new URL("/", url).href);
    const search = page.getByRole("search");
    await search.getByRole("textbox").fill(term);
    await search.getByRole("button", { name: "Search" }).click();

    const firstResult = page.locator("h2 a").first();
    await firstResult.waitFor();
    const product = (await firstResult.innerText()).trim();
    await firstResult.click();
    await page.locator('input[name="quantity"]').fill(String(quantity));
    await page.getByRole("button", { name: "Add to cart" }).click();
    items.push({ product, quantity });
  }

  await page.getByRole("link", { name: "Cart" }).click();
  const body = await page.locator("body").innerText();
  const total = body.match(/Total\s*:?\s*(\$[\d,]+\.\d{2})/i)?.[1];
  if (!total) throw new Error("Could not find the cart total");
  console.log(JSON.stringify({ items, total }));
} finally {
  await browser.close();
}
