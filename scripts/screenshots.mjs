// Captures README screenshots against a running app + seeded database.
// Usage (see README/CONTRIBUTING): start the app on SHOT_BASE_URL with a
// seeded DB, then `node scripts/screenshots.mjs`.
import { chromium } from '@playwright/test';

const base = process.env.SHOT_BASE_URL ?? 'http://localhost:3032';
const email = process.env.USER_EMAIL ?? 'you@example.com';
const password = process.env.USER_PASSWORD ?? 'change-me-immediately';

const shots = [
  ['/', 'home'],
  ['/progress', 'progress'],
  ['/programs/generate', 'program-generator'],
  ['/exercises', 'catalog'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 400, height: 860 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password').fill(password);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${base}/`, { timeout: 30000 });

for (const [path, name] of shots) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  console.log('captured', name);
}

await browser.close();
console.log('done');
