// Generates the README session GIF (no ffmpeg needed): drives a logging flow
// with Playwright, capturing frames and encoding an animated GIF with gifenc.
// Needs a running app (SHOT_BASE_URL) with a seeded DB.
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import pngjs from 'pngjs';
import fs from 'node:fs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const { PNG } = pngjs;

const base = process.env.SHOT_BASE_URL ?? 'http://localhost:3032';
const email = process.env.USER_EMAIL ?? 'you@example.com';
const password = process.env.USER_PASSWORD ?? 'change-me-immediately';
const W = 360;
const H = 780;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const enc = GIFEncoder();
const pause = (ms) => page.waitForTimeout(ms);
const tryClick = (loc) => loc.click({ timeout: 4000 }).catch(() => {});
const intoView = (loc) => loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});

async function frame(delay = 700) {
  const buf = await page.screenshot({ type: 'png' });
  const png = PNG.sync.read(buf);
  const palette = quantize(png.data, 256);
  const index = applyPalette(png.data, palette);
  enc.writeFrame(index, png.width, png.height, { palette, delay });
}

// Sign in
await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill(email);
await page.getByLabel('Password').fill(password);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${base}/`);
await pause(700);
await frame(900); // dashboard

// Session list
await page.goto(`${base}/session/new`, { waitUntil: 'networkidle' });
await pause(500);
await frame(900);

// Start the session
await page.getByRole('button', { name: 'Start this session' }).first().click();
await page.waitForURL(/\/session\//);
const logBtn = page.getByRole('button', { name: 'Log the set' });
await logBtn.waitFor({ timeout: 15000 });
await intoView(logBtn);
await pause(400);
await frame(800); // set input

// Set 1: reps, load, RIR
await tryClick(page.getByLabel('+1 rep'));
await frame(500);
await tryClick(page.getByRole('button', { name: /^\+.*kg$/ }));
await frame(500);
await tryClick(page.getByRole('button', { name: '2', exact: true }));
await frame(650);

// Log it -> rest timer
await logBtn.click();
const skipBtn = page.getByRole('button', { name: 'Skip' });
await skipBtn.waitFor({ timeout: 8000 });
await intoView(skipBtn);
await frame(800);
await pause(1000);
await frame(700); // tick
await pause(1000);
await frame(700); // tick
await skipBtn.click();

// Set 2
await logBtn.waitFor({ timeout: 8000 });
await intoView(logBtn);
await pause(500);
await frame(700);
await tryClick(page.getByLabel('+1 rep'));
await frame(500);
await logBtn.click();
await skipBtn.waitFor({ timeout: 8000 });
await intoView(skipBtn);
await frame(700);
await skipBtn.click();

// Next exercise
await pause(500);
await tryClick(page.getByRole('button', { name: 'Next' }));
await pause(700);
await frame(1000);

// Finish summary
await tryClick(page.getByRole('button', { name: 'Finish' }));
await pause(900);
await frame(1900);

enc.finish();
fs.mkdirSync('docs/screenshots', { recursive: true });
fs.writeFileSync('docs/screenshots/session.gif', Buffer.from(enc.bytes()));
const kb = Math.round(fs.statSync('docs/screenshots/session.gif').size / 1024);
console.log(`wrote docs/screenshots/session.gif (${kb} KB)`);

await browser.close();
