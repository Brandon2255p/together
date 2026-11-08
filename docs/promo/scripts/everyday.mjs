import { record } from "./rec.mjs";

await record("2-shopping-chores-calendar-gifts", { warm: ["/lists?tab=chores", "/calendar", "/wishlist", "/lists"], start: "/lists" }, async (s, page) => {
  // Shopping: add an item, tick two into the basket
  await s.hold(1500);
  await s.type(page.getByPlaceholder("Add an item…"), "Strawberries", 250);
  await page.keyboard.press("Enter");
  await s.hold(1100);
  await page.getByPlaceholder("Add an item…").blur();
  await s.tap(page.getByRole("checkbox", { name: /Oat milk/ }), 700);
  await s.tap(page.getByRole("checkbox", { name: /Avocados/ }), 1300);

  // Chores: tick one, add one
  await s.tap(page.getByRole("radio", { name: "Chores" }), 1600);
  await s.tap(page.getByRole("checkbox", { name: "Get keys from tenant" }), 1300);
  await s.tap(page.getByRole("button", { name: "Add a chore…" }), 1000);
  await s.type(page.getByPlaceholder("e.g. Water the plants"), "Clean the gutters", 500);
  await s.tap(page.locator('button[type="submit"]').last(), 1800);

  // Calendar: a busy month, then add a plan
  await s.nav("/calendar", 2000);
  await s.tap(page.getByRole("gridcell", { name: "17", exact: true }), 1500);
  await s.tap(page.getByRole("button", { name: "Add to calendar" }).first(), 1000);
  await s.type(page.getByPlaceholder("e.g. Dinner with Sam"), "Picnic at Kirstenbosch", 300);
  await s.tap(page.getByLabel("Time"), 200);
  await page.getByLabel("Time").fill("12:30");
  await s.hold(500);
  await s.type(page.getByPlaceholder("e.g. Sea Point"), "Kirstenbosch", 400);
  await s.tap(page.locator('button[type="submit"]').last(), 2000);

  // Wishlist: save towards a goal, then peek at gift ideas for Adele
  await s.nav("/wishlist", 2000);
  await s.tap(page.getByRole("button", { name: "Add savings" }).first(), 900);
  await page.keyboard.type("500", { delay: 120 });
  await s.hold(500);
  await s.tap(page.locator('button[type="submit"]').last(), 2200);
  await s.scroll(700, 1600);
  await s.top(600);
  await s.tap(page.getByRole("radio", { name: "For Adele" }), 2000);
  await s.tap(page.getByRole("button", { name: "Claim", exact: true }).first(), 2400);
});
