// capture-editor.mjs — capture progressive "stages" of the Mail Builder UI for
// the README demo GIF. Drives the live dev server with Playwright and writes
// screenshots/01..04.png.
//
// Prereqs: dev server running (npm run dev) and Playwright available. See
// build-editor-gif.sh, which wires NODE_PATH and the URL for you.
//
// Env:
//   APP_URL  — builder URL (default http://localhost:5173/mail-builder/)
//   OUT_DIR  — screenshot dir (default ./screenshots)

// Playwright isn't a dependency of this project; build-editor-gif.sh resolves
// it (from the global / npx cache) and passes the package path via env.
const _pw = await import(process.env.PLAYWRIGHT_PKG || 'playwright');
const chromium = _pw.chromium || _pw.default?.chromium;
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_URL = process.env.APP_URL || 'http://localhost:5173/mail-builder/';
const OUT_DIR = process.env.OUT_DIR || resolve(__dirname, 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

// Capture viewport — wide enough to show both the input panel and the live
// preview side by side (the layout is two-column at >= 900px).
const WIDTH = 1440;
const HEIGHT = 900;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});

// Start from a clean default state (no leftover localStorage draft).
await page.goto(APP_URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.removeItem('mail-builder'));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.EasyMDEContainer .CodeMirror');
await page.waitForTimeout(600);

// Helper: set an EasyMDE editor's content by id of its underlying textarea.
async function setEditor(textareaId, value) {
  await page.evaluate(
    ({ textareaId, value }) => {
      const ta = document.getElementById(textareaId);
      // EasyMDE inserts its container as the textarea's next sibling.
      const container = ta.nextElementSibling;
      const cm = container.querySelector('.CodeMirror').CodeMirror;
      cm.setValue(value);
    },
    { textareaId, value },
  );
}

async function setInput(id, value) {
  await page.fill(`#${id}`, value);
}

let frame = 0;
async function shot() {
  frame += 1;
  const path = `${OUT_DIR}/${String(frame).padStart(2, '0')}.png`;
  await page.screenshot({ path });
  console.log('wrote', path);
}

// --- Stage 1: fresh editor, default content ------------------------------
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot();

// --- Stage 2: set the headline (expand the Greeting panel, edit the title) -
// The title input lives inside the collapsed "Greeting" <details>.
await page.click('summary:has-text("Greeting")');
await page.waitForTimeout(300);
await setInput('lang1-title', 'Riverside Community Center — June Update');
await page.waitForTimeout(900); // let the debounced live preview catch up
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await shot();

// --- Stage 3: write the body / intro in Markdown -------------------------
await setEditor(
  'lang1-intro',
  [
    'This month: our **community garden** opens, new summer classes,',
    'and the annual block party. See the full calendar on',
    '[our website](https://example.com).',
  ].join('\n'),
);
await page.waitForTimeout(900);
await shot();

// --- Stage 4: fill the table of contents ---------------------------------
const tocItems = ['Community garden opening', 'New summer classes', 'Annual block party'];
const tocInputs = await page.$$('#lang1-toc-list input');
for (let i = 0; i < tocItems.length && i < tocInputs.length; i++) {
  await tocInputs[i].fill(tocItems[i]);
}
await page.waitForTimeout(900);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot();

await browser.close();
console.log('done');
