// Regression test for mobile filter-chip selection feedback.
//
// Guards the bug where the Players chips were the only ones missing
// `data-filter="chip"`: they still filtered correctly, but gave zero visual
// feedback on tap, so the filter looked dead. Nothing else catches this —
// typecheck passes, the HTML looks fine, and the filter genuinely works.
//
// Why the attribute matters: FormAutoSubmit deliberately bails below 861px so
// the mobile sheet can batch its submits. That leaves the server-computed
// `active` classes stale on tap, so the only thing painting selection is
// `[data-filter="chip"]:has(input:checked)` in apps/web/src/app/globals.css.
//
//   node tools/scripts/check-filter-chips.mjs [baseUrl]
//
// Exits non-zero if any chip group stops responding to a tap.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

let failures = 0;
try {
  await page.goto(`${BASE}/es/buscar?q=catan`, { waitUntil: 'networkidle' });
  await page.click('.mobile-filter-trigger');
  await page.waitForTimeout(500);

  const sections = await page.$$('.catalog-filter-section');
  if (!sections.length) throw new Error('no filter sections rendered — did the sheet open?');

  let chipGroups = 0;
  for (const section of sections) {
    const title = (await section.$eval('h3', (el) => el.textContent))?.trim() ?? '?';
    const chips = await section.$$('[data-filter="chip"]');
    // Sort/Availability/Categories are a select, a toggle and rows — not chips.
    if (!chips.length) continue;
    chipGroups += 1;

    // Skip chips that are already checked: tapping one changes nothing and
    // reports a false failure. (This exact trap produced a phantom bug once.)
    let target = null;
    for (const chip of chips) {
      const checked = await chip.$eval('input', (i) => i.checked).catch(() => false);
      if (!checked) { target = chip; break; }
    }
    if (!target) continue;

    const before = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
    await target.click();
    await page.waitForTimeout(250);
    const after = await target.evaluate((el) => getComputedStyle(el).backgroundColor);

    if (before === after) {
      failures += 1;
      console.error(`FAIL ${title}: tapping an unchecked chip did not change its background (${before}).`);
      console.error(`     Most likely the chip lost data-filter="chip" — use FilterChip from @retail-os/ui-react.`);
    } else {
      console.log(`ok   ${title}: ${before} -> ${after}`);
    }
  }

  if (chipGroups === 0) {
    failures += 1;
    console.error('FAIL no [data-filter="chip"] found anywhere — the attribute is gone from FilterChip.');
  }
} finally {
  await browser.close();
}

process.exit(failures ? 1 : 0);
