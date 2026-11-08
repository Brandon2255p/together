import { record } from "./rec.mjs";

await record("3-places-plans-visits", { warm: ["/places?tab=want", "/places/new?tab=want", "/places/p-1", "/places/p-5", "/calendar", "/places"], start: "/places" }, async (s, page) => {
  // Been and want to go
  await s.hold(1500);
  await s.scroll(420, 1500);
  await s.top(500);
  await s.tap(page.getByRole("radio", { name: /Want to go/ }), 2000);

  // add a place from Google Maps
  await s.tap('a[href^="/places/new"]', 1200);
  await s.type(page.getByPlaceholder("Search for a place, or paste a link"), "Kloof Street Ca", 1300);
  await s.tap(page.getByText("Kloof Street Café", { exact: false }).first(), 2600);
  await s.tap(page.getByRole("button", { name: "Add place" }), 400);
  await page.waitForURL(/\/places\/(?!new)[^/?]+$/, { timeout: 8000 }).catch(() => {});
  await s.hold(2400);
  if (!/\/places\/(?!new)[^/?]+$/.test(page.url())) {
    await s.tap(page.getByRole("link", { name: /Kloof Street Café/ }).first(), 2400);
  }

  // plan to go: it lands on the calendar
  await s.tap(page.getByRole("button", { name: /^Plan to go/ }), 1100);
  await page.getByLabel("Day").fill("2026-11-14");
  await s.hold(700);
  await s.tap(page.getByLabel("Time"), 200);
  await page.getByLabel("Time").fill("09:30");
  await s.hold(500);
  await s.tap(page.locator('button[type="submit"]').last(), 2400);

  // log a visit at Nobu
  await s.tap(page.getByRole("link", { name: "Back to places" }), 1300);
  await s.tap(page.getByRole("radio", { name: /^Been/ }), 1300);
  await s.tap('a[href="/places/p-1"]', 2000);
  await s.scroll(500, 1600);
  await s.tap(page.getByRole("button", { name: "Log a visit" }), 1000);
  await s.type(page.getByPlaceholder("e.g. Dinner with Mom"), "Adele's birthday dinner", 300);
  await s.type(page.getByPlaceholder("A note (optional)"), "Omakase at the bar. Worth every cent.", 400);
  await s.tap(page.getByRole("radio", { name: "5 stars" }), 700);
  await s.tap(page.getByRole("button", { name: "Save visit" }), 2600);

  // the plan on the calendar
  await s.nav("/calendar", 1600);
  await s.tap(page.getByRole("gridcell", { name: "14", exact: true }), 2600);
});
