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
  const items = [];

  for (const [term, quantity] of requests) {
    await page.goto(url);
    await page.getByRole("textbox", { name: "Search" }).fill(term);
    await page.getByRole("button", { name: "Search" }).click();

    const firstResult = page.locator("main li a").first();
    await firstResult.waitFor();
    const product = (await firstResult.innerText()).trim();
    await firstResult.click();

    await page.getByRole("spinbutton", { name: "Quantity" }).fill(String(quantity));
    await page.getByRole("button", { name: "Add to cart" }).click();
    items.push({ product, quantity });
  }

  await page.getByRole("link", { name: "Cart" }).click();
  const totalText = await page.locator("main").innerText();
  const totalMatch = totalText.match(/Total\s*:?\s*(\$[\d,.]+(?:\.\d{2})?)/i);
  if (!totalMatch) throw new Error(`Could not find cart total in: ${totalText}`);

  console.log(JSON.stringify({ items, total: totalMatch[1] }));
} finally {
  await browser.close();
}
