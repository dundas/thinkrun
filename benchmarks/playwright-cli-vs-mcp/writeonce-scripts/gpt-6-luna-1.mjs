import { chromium } from "playwright";

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error("Usage: node shop.mjs <shop url>");

const requested = [
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
  await page.goto(baseUrl);

  const items = [];
  for (const [term, quantity] of requested) {
    await page.goto(baseUrl);
    await page.getByRole("textbox", { name: "Search" }).fill(term);
    await page.getByRole("button", { name: "Search" }).click();

    const firstResult = page.locator("main li").first().getByRole("link");
    const product = (await firstResult.innerText()).trim();
    await firstResult.click();
    await page.getByRole("spinbutton", { name: "Quantity" }).fill(String(quantity));
    await page.getByRole("button", { name: "Add to cart" }).click();
    items.push({ product, quantity });
  }

  await page.getByRole("link", { name: "Cart" }).click();
  const totalText = await page.getByText(/^Total:/).innerText();
  const total = totalText.replace(/^Total:\s*/, "").trim();
  console.log(JSON.stringify({ items, total }));
} finally {
  await browser.close();
}
