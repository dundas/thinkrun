import { chromium } from "playwright";

const shopUrl = process.argv[2];
if (!shopUrl) throw new Error('Usage: node shop.mjs <shop url>');

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const items = [];
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

  for (const [term, quantity] of requests) {
    await page.goto(shopUrl);
    await page.getByRole("textbox", { name: "Search", exact: true }).fill(term);
    await Promise.all([
      page.waitForURL(url => url.searchParams.get("q") === term),
      page.getByRole("button", { name: "Search", exact: true }).click(),
    ]);
    await page.locator("main h2 a").first().click();
    const product = (await page.locator("main h1").innerText()).trim();
    await page.getByRole("spinbutton", { name: "Quantity" }).fill(String(quantity));
    await Promise.all([
      page.waitForURL("**/cart"),
      page.getByRole("button", { name: "Add to cart", exact: true }).click(),
    ]);
    items.push({ product, quantity });
  }

  await page.getByRole("link", { name: "Cart", exact: true }).click();
  const totalText = await page.locator("main p").filter({ hasText: /^Total:/ }).innerText();
  const total = totalText.replace(/^Total:\s*/, "").trim();
  console.log(JSON.stringify({ items, total }));
} finally {
  await browser.close();
}
