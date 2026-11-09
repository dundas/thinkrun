# Prompts

Every prompt the agents received, verbatim from the runners. `<shop url>` is the local test shop
(`http://127.0.0.1:<port>/`, started fresh for each run by `fixture.ts`). Nothing else was added to the agents'
context: Claude Code ran with `--setting-sources project --strict-mcp-config --no-session-persistence`, and Codex with
`--ignore-user-config --ignore-rules --ephemeral` and user skills disabled.

## Reply format (appended to every shop task)

> Then reply with only this JSON: {"items": [{"product": "<product name>", "quantity": <quantity>}], "total": "<cart total>"}

## Shop: buy one item (`simple`, 20 products; `dense`, 400 products)

> Open `<shop url>` in the browser. Search for "liquid". Open the first result. Set the quantity to 2 and add it to the cart. Open the cart and check the total. *(reply format)*

## Shop: eight-item job (`long`, 400 products)

> Open `<shop url>` in the browser. For each item below, go back to the home page, use the search box to search for its term, open the first result, set the quantity and add it to the cart, in this order: "Lantern" quantity 1, "Backpack" quantity 2, "Kettle" quantity 1, "Notebook" quantity 3, "Speaker" quantity 1, "Thermos" quantity 2, "Headset" quantity 1, "Keyboard" quantity 2. Add each item exactly once. Then open the cart and check the total. *(reply format)*

## Shop: eight-item job, step by step (`stepwise`)

The eight-item prompt with this inserted before the reply format:

> Work one browser action at a time: make each navigation, search, click, fill and add to cart its own separate tool call, and read the result before choosing the next action. Don't write scripts or loops, don't chain browser commands together, and don't run code in the page.

## Docs task (Playwright's own demo)

> Open https://playwright.dev. Search for locators and check that the doc is available for each language: JavaScript, Python, Java and .NET. Take a screenshot of the doc for each language and save it as a file. Then reply with only this JSON: {"languages": [{"language": "<language>", "url": "<doc url>", "available": <true or false>, "screenshot": "<file name>"}]}

Scored as a pass only when all four locator doc URLs were found and at least four distinct screenshots were saved,
without curl/wget.

## Write the script once (`writeonce`)

> The shop is at `<shop url>`. For each item below, the task is to go back to the home page, use the search box to search for its term, open the first result, set the quantity and add it to the cart, in this order: "Lantern" quantity 1, "Backpack" quantity 2, "Kettle" quantity 1, "Notebook" quantity 3, "Speaker" quantity 1, "Thermos" quantity 2, "Headset" quantity 1, "Keyboard" quantity 2. Add each item exactly once. Then open the cart and read the total. Write a Playwright script saved as shop.mjs that does this whole task in a fresh headless browser when run as: node shop.mjs <shop url>. It must use import { chromium } from "playwright", launch with channel "chrome", and print only this JSON: {"items": [{"product": "<product name>", "quantity": <quantity>}], "total": "<cart total>"}. Use the browser to inspect the shop if you need to, and run the script once to check it works. The shop's cart is not reset between runs, so a checking run may leave items behind; the script will be judged on an empty cart. When you're finished, reply with only the word done.

Each written script was then run five more times against a fresh shop with no agent involved
(`writeonce-scripts/` holds every script the agents wrote).

## agent-browser

The same shop and docs prompts, with the agent given the `agent-browser` CLI and its skill instead of Playwright
(`run-extras.ts`).
