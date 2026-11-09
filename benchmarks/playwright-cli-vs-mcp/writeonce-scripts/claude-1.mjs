import { chromium } from "playwright";

const base = process.argv[2];
const plan = [["Lantern",1],["Backpack",2],["Kettle",1],["Notebook",3],["Speaker",1],["Thermos",2],["Headset",1],["Keyboard",2]];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const items = [];
for (const [term, qty] of plan) {
  await page.goto(base);
  await page.getByRole("search").getByRole("textbox").fill(term);
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/q=/);
  await page.locator("main ul h2 a").first().click();
  await page.waitForSelector("input[name=quantity]");
  const name = (await page.locator("main h1").innerText()).trim();
  await page.locator("input[name=quantity]").fill(String(qty));
  await Promise.all([
    page.waitForLoadState("load"),
    page.getByRole("button", { name: "Add to cart" }).click(),
  ]);
  items.push({ product: name, quantity: qty });
}
await page.goto(new URL("/cart", base).href);
const totalText = (await page.locator("main").getByText(/Total/).first().innerText()).trim();
const total = totalText.replace(/^.*?Total:?\s*/i, "");
await browser.close();
console.log(JSON.stringify({ items, total }));
