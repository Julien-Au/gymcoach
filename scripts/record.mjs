// Records a demo flow as a video (webm) with Playwright. Convert to GIF/MP4
// with ffmpeg afterwards (see the npm run media:* scripts / README).
// Usage: SHOT_BASE_URL=... node scripts/record.mjs <session|chat|debrief|program>
// Needs a running app (LLM_PROVIDER=demo for the AI flows) and a seeded DB.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const scenario = process.argv[2] ?? 'session';
const base = process.env.SHOT_BASE_URL ?? 'http://localhost:3032';
const email = process.env.USER_EMAIL ?? 'you@example.com';
const password = process.env.USER_PASSWORD ?? 'change-me-immediately';
const outDir = 'docs/media/raw';
fs.mkdirSync(outDir, { recursive: true });
const size = { width: 360, height: 800 };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size },
});
const page = await ctx.newPage();
const video = page.video();
const pause = (ms) => page.waitForTimeout(ms);
const tryClick = (loc) => loc.click({ timeout: 5000 }).catch(() => {});
const intoView = (loc) => loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

// Sign in
await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password').fill(password);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${base}/`);
await pause(600);

if (scenario === 'session') {
  await page.goto(`${base}/session/new`, { waitUntil: 'networkidle' });
  await pause(600);
  await page.getByRole('button', { name: 'Start this session' }).first().click();
  await page.waitForURL(/\/session\//);
  const logBtn = page.getByRole('button', { name: 'Log the set' });
  await logBtn.waitFor({ timeout: 15000 });
  await intoView(logBtn);
  await pause(700);
  await tryClick(page.getByLabel('+1 rep'));
  await pause(400);
  await tryClick(page.getByRole('button', { name: /^\+.*kg$/ }));
  await pause(400);
  await tryClick(page.getByRole('button', { name: '2', exact: true }));
  await pause(500);
  await logBtn.click();
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ timeout: 8000 });
  await intoView(skip);
  await pause(2500);
  await skip.click();
  await logBtn.waitFor({ timeout: 8000 });
  await intoView(logBtn);
  await pause(600);
  await tryClick(page.getByLabel('+1 rep'));
  await pause(400);
  await logBtn.click();
  await skip.waitFor({ timeout: 8000 });
  await intoView(skip);
  await pause(1500);
  await skip.click();
  await pause(400);
  await tryClick(page.getByRole('button', { name: 'Next' }));
  await pause(1000);
  await tryClick(page.getByRole('button', { name: 'Finish' }));
  await pause(2200);
} else if (scenario === 'chat') {
  await page.goto(`${base}/chat`, { waitUntil: 'networkidle' });
  await pause(700);
  const ta = page.getByPlaceholder('Message your coach...');
  await ta.click();
  await ta.type('How is my bench progressing, and am I doing enough chest volume?', { delay: 22 });
  await pause(400);
  await ta.press('Enter');
  await page.getByText(/next push day/i).waitFor({ timeout: 25000 });
  await pause(1800);
} else if (scenario === 'debrief') {
  await page.goto(`${base}/coach`, { waitUntil: 'networkidle' });
  await pause(700);
  await page.getByRole('button', { name: 'Request a weekly debrief' }).click();
  await page.getByText('Suggested adjustments').waitFor({ timeout: 25000 });
  await pause(700);
  const applyBtn = page.getByRole('button', { name: /Apply \d+ adjustment/ });
  await intoView(applyBtn);
  await pause(1300);
  await applyBtn.click();
  await page.getByText(/adjustments? applied/i).waitFor({ timeout: 15000 });
  await pause(1900);
} else if (scenario === 'program') {
  await page.goto(`${base}/programs/generate`, { waitUntil: 'networkidle' });
  await pause(600);
  const goal = page.getByPlaceholder(/Hypertrophy/i);
  await goal.click();
  await goal.type(
    'Hypertrophy, 4 sessions a week, push pull legs, bad left shoulder so go easy on overhead pressing.',
    { delay: 16 },
  );
  await pause(400);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByText('Review and edit').waitFor({ timeout: 25000 });
  await pause(1300);
  await page.mouse.wheel(0, 420);
  await pause(1400);
  await page.mouse.wheel(0, 420);
  await pause(1600);
}

await pause(400);
await ctx.close();
const src = await video.path();
await browser.close();
const dest = `${outDir}/${scenario}.webm`;
fs.renameSync(src, dest);
console.log('WEBM', dest);
