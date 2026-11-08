# Promo videos

Short screen captures of the app for marketing. They were recorded on the stub backend at phone size: 390×844 at 2×,
so 780×1688 H.264.

| Video | What it shows |
| --- | --- |
| [1-challenges.mp4](1-challenges.mp4) | The streak pill on Home and the Challenges list. Finishing a week ("Week complete!", then the streak growing to 12), saving a missed day with a booster, and starting a new challenge |
| [2-shopping-chores-calendar-gifts.mp4](2-shopping-chores-calendar-gifts.mp4) | Adding and ticking shopping, ticking and adding chores, and adding a plan on the calendar. Adding savings to a goal, and claiming a gift on Adele's wishlist |
| [3-places-plans-visits.mp4](3-places-plans-visits.mp4) | Been and want-to-go places, and adding a place from a Google Maps search. Planning to go (it lands on the calendar), and logging a visit with a rating |

## Recording them again

The scripts in [scripts/](scripts/) drive the app with Playwright and film it with Chrome's screencast. Then they
encode the frames with ffmpeg. Taps show as a soft ring and the Next.js dev badge is hidden.

They need three things:

- `playwright-core`.
- A Playwright Chromium. Install it with `npx playwright install chromium`, then set `CHROMIUM` to its executable (or edit `EXE` in `rec.mjs`).
- `ffmpeg` on the path.

To record:

1. Start the dev server on the stub backend (`pnpm dev`, with `USE_STUB_DATABASE=true`).
2. In a folder with `playwright-core` installed, run one script, for example `node challenges.mjs`. It writes
   `out/<name>.mp4`.
3. Restart the dev server before the next one. Each script changes the stub's data, which lives for the life of the
   server.

The scenes assume the seed data and its dates as of Sun 8 Nov 2026. For example, "Gym together" needs one more gym
visit and two more 10k-step days to finish the week.
