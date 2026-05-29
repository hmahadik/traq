import { test, expect } from '@playwright/test';

/**
 * Reproduces: max zoom-out + fast backward pan => freeze => jump to absurd timestamps.
 * Uses CDP CPU throttling to emulate the WebKitGTK main-thread freeze so the
 * reload-cascade race surfaces. A backward pan should only move the center EARLIER;
 * any forward jump (or future date, or domain snapping to today while panned back) is the bug.
 */

async function geo(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.select-none')!;
    const r = svg.getBoundingClientRect();
    return { centerX: r.x + r.width / 2, centerY: r.y + 130, width: r.width };
  });
}

function centerToMs(text: string): number | null {
  // "Fri, May 29 • 1:38 PM"
  const m = text.match(/(\w+)\s+(\d+)\s+•\s+(\d+):(\d+)\s+(AM|PM)/);
  if (!m) return null;
  const yr = new Date().getFullYear();
  let h = parseInt(m[3], 10); if (m[5] === 'PM' && h !== 12) h += 12; if (m[5] === 'AM' && h === 12) h = 0;
  const d = new Date(`${m[1]} ${m[2]}, ${yr} ${h}:${m[4]}`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

test('fast backward pan at max zoom-out does not freeze, jump, or land on absurd timestamps', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('svg.select-none .date-label-center', { timeout: 20_000 });
  await page.waitForTimeout(1500);

  const g = await geo(page);
  await page.mouse.move(g.centerX, g.centerY);
  for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const w = window as any; w.__rec = [];
    const grab = () => ({ t: performance.now(),
      center: document.querySelector('.date-label-center')?.textContent ?? '',
      left: document.querySelector('.date-label-left')?.textContent ?? '',
      right: document.querySelector('.date-label-right')?.textContent ?? '' });
    w.__rec.push(grab());
    const obs = new MutationObserver(() => w.__rec.push(grab()));
    for (const sel of ['.date-label-center', '.date-label-left', '.date-label-right']) {
      const el = document.querySelector(sel); if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
    }
    w.__obs = obs;
  });

  // Emulate the WebKitGTK freeze: throttle CPU 6x so the reload cascade can't keep up.
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  const drag = Math.floor(g.width * 0.4);
  for (let rep = 0; rep < 14; rep++) {
    await page.mouse.move(g.centerX - drag / 2, g.centerY);
    await page.mouse.down();
    for (let s = 1; s <= 5; s++) { await page.mouse.move(g.centerX - drag / 2 + (drag * s) / 5, g.centerY); await page.waitForTimeout(6); }
    await page.mouse.up();
    await page.waitForTimeout(30);
  }
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForTimeout(4000);

  const rec = await page.evaluate(() => { const w = window as any; w.__obs?.disconnect(); return w.__rec as Array<{t:number;center:string;left:string;right:string}>; });

  const todayMs = Date.now();
  let futureHits = 0, forwardJumps = 0, blankHits = 0, maxForwardJumpHrs = 0;
  let prevMs: number | null = null;
  for (const r of rec) {
    if (!r.center) { blankHits++; continue; }
    const ms = centerToMs(r.center);
    if (ms == null) continue;
    if (ms > todayMs + 6 * 3600 * 1000) futureHits++;
    if (prevMs != null && ms - prevMs > 90 * 60 * 1000) { // jumped forward >90min between samples
      forwardJumps++;
      const hrs = (ms - prevMs) / 3600000; if (hrs > maxForwardJumpHrs) maxForwardJumpHrs = hrs;
    }
    prevMs = ms;
  }
  const uniqDomains = [...new Set(rec.map(r => `${r.left} .. ${r.right}`))];

  console.log('\n===== FAST BACKWARD PAN @ MAX ZOOM-OUT (6x CPU throttle) =====');
  console.log(`label mutations: ${rec.length}`);
  console.log(`final center: "${rec[rec.length-1]?.center}"  domain: "${rec[rec.length-1]?.left}".."${rec[rec.length-1]?.right}"`);
  console.log(`FUTURE-date centers: ${futureHits}`);
  console.log(`FORWARD jumps (>90min while panning backward): ${forwardJumps}  (max ${maxForwardJumpHrs.toFixed(1)}h)`);
  console.log(`blank-label frames (No data / freeze): ${blankHits}`);
  console.log(`distinct domains (${uniqDomains.length}):`); uniqDomains.slice(0,15).forEach(d=>console.log('   '+d));
  // print the raw center sequence to eyeball jumps
  console.log('center sequence:'); console.log('   ' + rec.map(r=>r.center||'∅').join(' | '));
  console.log('==============================================================\n');

  // Regression guards for the freeze→jump→absurd-timestamp bug:
  // a backward pan must never jump the center FORWARD, never show a future date,
  // and never blank the timeline (empty-state unmount → re-init).
  expect(rec.length, 'should have recorded label changes').toBeGreaterThan(0);
  expect(futureHits, 'center must never show a future date during backward pan').toBe(0);
  expect(forwardJumps, 'backward pan must never jump the center forward (absurd-timestamp jump)').toBe(0);
  expect(blankHits, 'timeline must stay mounted (no No-data flash) during fast panning').toBe(0);
});
