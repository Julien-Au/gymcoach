import { test, expect } from '@playwright/test';

// Exercise technique frames (issue #275) are public-domain files under
// /public/exercise-media. They are rendered through next/image, whose
// optimizer fetches the source file with a cookie-less internal request.
// The auth middleware used to redirect that request to /login, so the
// optimizer received an HTML page and answered 400: every technique image
// was broken in production. Both requests are made WITHOUT a session on
// purpose, exactly like the optimizer does.

const FRAME = '/exercise-media/free-exercise-db/Barbell_Bench_Press_-_Medium_Grip/0.jpg';

test.describe('exercise technique media', () => {
  test('the raw frame is served without a session', async ({ request }) => {
    const res = await request.get(FRAME, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^image\/jpeg/);
  });

  test('the next/image optimizer can read the frame', async ({ request }) => {
    const res = await request.get(`/_next/image?url=${encodeURIComponent(FRAME)}&w=384&q=75`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^image\//);
  });

  test('pages still require a session', async ({ request }) => {
    const res = await request.get('/programs', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/login');
  });
});
