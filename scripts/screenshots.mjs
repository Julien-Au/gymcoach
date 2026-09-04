// Captures README screenshots against a running app + seeded database.
// Usage (see README/CONTRIBUTING): start the app on SHOT_BASE_URL with a
// seeded DB, then `node scripts/screenshots.mjs`.
import { chromium } from '@playwright/test';

const base = process.env.SHOT_BASE_URL ?? 'http://localhost:3032';
const email = process.env.USER_EMAIL ?? 'you@example.com';
const password = process.env.USER_PASSWORD ?? 'change-me-immediately';

// An optional `openOn` heading scrolls that section into view before the
// capture. The progress page leads with the bodyweight card, which is the
// least distinctive thing on it; the muscle heat map is the frame worth
// showing, and it sits below the fold.
const shots = [
  ['/', 'home'],
  ['/progress', 'progress', { openOn: 'Muscle heat map' }],
  ['/programs/generate', 'program-generator'],
  ['/exercises', 'catalog'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 400, height: 860 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// Self-verification: never capture a screenshot of a broken page. A capture
// run against a crashed/mid-restart server (e.g. a chunk-load exception) would
// otherwise silently commit the Next.js "Application error" page, which no
// gate inspects (lesson L12). Watch errors and assert health before each shot.
const failures = [];
page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
page.on('response', (res) => {
  if (res.status() >= 500) failures.push(`HTTP ${res.status()} ${res.url()}`);
});
const ERROR_TEXTS = [
  'Application error',
  'client-side exception',
  'Internal Server Error',
  'This page could not be found',
  'Unhandled Runtime Error',
];
async function assertHealthy(label) {
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  const hit = ERROR_TEXTS.find((t) => body.includes(t));
  if (hit) failures.push(`on-screen "${hit}" at ${label}`);
  if (failures.length > 0) {
    console.error('[screenshots] ABORT - the app was not healthy:');
    for (const f of failures) console.error('  - ' + f);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password').fill(password);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${base}/`, { timeout: 30000 });
await assertHealthy('after sign in');

for (const [path, name, opts] of shots) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  // Park the pointer: after the sign-in click it rests wherever the button
  // was, and at 400px that lands on a card control, painting its hover state
  // into the capture (that is how #330 got its "large grey box").
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1500);
  await assertHealthy(`page ${path}`);
  if (opts?.openOn) {
    // Fail loudly rather than silently capturing the top of the page: a
    // renamed or removed section must not degrade into a wrong screenshot.
    const target = page.getByText(opts.openOn, { exact: false }).first();
    if ((await target.count()) === 0) {
      console.error(`[screenshots] ABORT - "${opts.openOn}" not found on ${path}`);
      await browser.close().catch(() => {});
      process.exit(1);
    }
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  console.log('captured', name, '- healthy');
}

await browser.close();
console.log('done - all screenshots verified healthy');
