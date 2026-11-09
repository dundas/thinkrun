import { chromium } from "playwright";

const home = new URL("/", process.argv[2]).href;
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
  const context = await browser.newContext();
  const page = await context.newPage();
  const items = [];

  for (const [term, quantity] of requests) {
    await page.goto(home);
    await page.getByRole("textbox", { name: "Search", exact: true }).fill(term);
    await Promise.all([
      page.waitForURL(url => url.searchParams.get("q") === term),
      page.getByRole("button", { name: "Search", exact: true }).click(),
    ]);
    await page.getByRole("main").getByRole("heading", { level: 2 })
      .first().getByRole("link").click();
    const product = (await page.getByRole("main")
      .getByRole("heading", { level: 1 }).innerText()).trim();
    await page.getByRole("spinbutton", { name: "Quantity", exact: true })
      .fill(String(quantity));
    await Promise.all([
      page.waitForURL(url => url.pathname === "/cart"),
      page.getByRole("button", { name: "Add to cart", exact: true }).click(),
    ]);
    items.push({ product, quantity });
  }

  await page.getByRole("link", { name: "Cart", exact: true }).click();
  const totalText = await page.getByRole("main").locator("p")
    .filter({ hasText: /^Total:/ }).innerText();
  const total = totalText.replace(/^Total:\s*/, "").trim();
  console.log(JSON.stringify({ items, total }));
} finally {
  await browser.close();
}
