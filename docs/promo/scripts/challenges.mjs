import { record } from "./rec.mjs";

await record("1-challenges", { warm: ["/challenges", "/challenges/ch-2", "/challenges/ch-3", "/challenges/ch-1"], start: "/home" }, async (s, page) => {
  // Home: the streak pill
  await s.hold(1800);
  await s.tap(page.getByRole("link", { name: /^Challenges:/ }), 2200);

  // the list
  await s.scroll(260, 1400);
  await s.top(500);

  // Gym together: finish the week
  await s.tap('a[href="/challenges/ch-2"]', 2000);
  await s.into(page.getByRole("button", { name: "Add one to 10k steps" }));
  await s.hold(900);
  await s.tap(page.getByRole("button", { name: "Add one to Go to the gym" }), 1100);
  await s.tap(page.getByRole("button", { name: "Add one to 10k steps" }), 700);
  await s.tap(page.getByRole("button", { name: "Add one to 10k steps" }), 400);
  await page.getByRole("button", { name: "Continue" }).waitFor();
  await s.hold(2600);
  await s.tap(page.getByRole("button", { name: "Continue" }), 400);
  await page.getByRole("button", { name: "Keep it going" }).waitFor();
  await s.hold(4200);
  await s.tap(page.getByRole("button", { name: "Keep it going" }), 1500);

  // Read before bed: a missed day, saved by a booster
  await s.tap(page.getByRole("link", { name: "Back to challenges" }), 1500);
  await s.tap('a[href="/challenges/ch-3"]', 2600);
  await s.tap(page.getByRole("button", { name: "Use a booster", exact: true }), 400);
  await page.getByRole("button", { name: "Back to it" }).waitFor();
  await s.hold(4000);
  await s.tap(page.getByRole("button", { name: "Back to it" }), 1500);

  // start a new one
  await s.tap(page.getByRole("link", { name: "Back to challenges" }), 1300);
  await s.tap(page.getByRole("button", { name: "New challenge" }), 1000);
  await s.type(page.getByPlaceholder("e.g. Gym together"), "Walk the dog", 300);
  await s.tap(page.getByRole("radio", { name: "Daily" }), 600);
  await s.type(page.getByPlaceholder("e.g. Go to the gym"), "Morning walk", 300);
  await s.tap(page.getByRole("button", { name: "Adele" }), 700);
  await s.tap(page.getByRole("button", { name: "Start challenge" }), 2600);
});
