import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.URL || 'http://localhost:4173';
const OUT = process.env.OUT || './screenshots';

const TABS = [
  'dashboard',
  'documents',
  'ai-chat',
  'quiz-generator',
  'flashcards',
  'mind-map',
  'ai-diagram-maker',
  'concept-visualizer',
  'audio-recap',
  'quick-revise',
  'pdf-qa',
  'visual-ai',
  'voice-chat',
  'study-notes',
  'study-groups',
  'pomodoro',
  'history',
  'settings',
  'youtube',
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// Auth screen
await page.goto(BASE_URL);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/00-auth.png`, fullPage: false });
console.log('captured auth');

// Click "Continue" / Sign in button to enter the app
await page.click('button.btn.is-accent:has-text("Sign in")', { timeout: 5000 }).catch(async () => {
  // try alternative text
  await page.click('button:has-text("Sign in")').catch(() => {});
  await page.click('button:has-text("Continue")').catch(() => {});
});
await page.waitForTimeout(800);

// Capture each tab
for (let i = 0; i < TABS.length; i++) {
  const tab = TABS[i];
  // Click sidebar nav button
  const clicked = await page
    .evaluate(t => {
      const btns = document.querySelectorAll('button.nav-item, .nav-item');
      for (const b of btns) {
        if (b.dataset && b.dataset.tab === t) { b.click(); return true; }
      }
      return false;
    }, tab)
    .catch(() => false);

  if (!clicked) {
    // fallback: try clicking by visible text via aria-label or icon name
    await page.evaluate(t => {
      const items = document.querySelectorAll('[class*="nav"] button, aside button');
      for (const el of items) {
        const txt = el.textContent.trim().toLowerCase();
        if (txt.includes(t.replace(/-/g, ' '))) { el.click(); return; }
      }
    }, tab);
  }

  await page.waitForTimeout(700);
  const num = String(i + 1).padStart(2, '0');
  await page.screenshot({ path: `${OUT}/${num}-${tab}.png`, fullPage: false });
  console.log(`captured ${tab}`);
}

await browser.close();
console.log('done');
