import { test, expect } from '@playwright/test';

/**
 * Reproduces the multi-day zoom-out + drag bug:
 *
 * When the timeline is zoomed out to span 3 days and the user drags to pan,
 * the center label snaps to an unintended time after the drag ends. This
 * happens because:
 *   1. Drag ends → onPlayheadChange fires → updateCenterFromPlayhead
 *   2. If the playhead crossed a day boundary → setCenterDate fires
 *   3. New centerDate → React Query fetches new days → loadedDays changes
 *   4. D3 useEffect re-runs → zoom.transform restore fires zoom handler again
 *   5. Playhead position calculated during restore differs from where user left it
 *
 * The snap may be transient (flash and correct) or permanent. A MutationObserver
 * on the center label captures EVERY text change at frame-level precision,
 * so even a single-frame snap is caught.
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Center label format: "Fri, Feb 6 • 4:15 PM" */
function parseCenterLabel(text: string): { dayOfMonth: number; hour: number; minute: number } | null {
  const match = text.match(/\w+,\s+\w+\s+(\d+)\s+•\s+(\d+):(\d+)\s+(AM|PM)/);
  if (!match) return null;
  const dayOfMonth = parseInt(match[1], 10);
  let hour = parseInt(match[2], 10);
  const minute = parseInt(match[3], 10);
  const ampm = match[4];
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return { dayOfMonth, hour, minute };
}

/** Flatten to absolute minutes for easy comparison across day boundaries. */
function toAbsoluteMinutes(p: { dayOfMonth: number; hour: number; minute: number }): number {
  return p.dayOfMonth * 24 * 60 + p.hour * 60 + p.minute;
}

function labelToMinutes(text: string): number | null {
  const parsed = parseCenterLabel(text);
  return parsed ? toAbsoluteMinutes(parsed) : null;
}

async function getCenterLabelText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.date-label-center');
    return el?.textContent ?? '';
  });
}

async function getCenterLabelMinutes(page: import('@playwright/test').Page): Promise<{
  text: string;
  minutes: number;
}> {
  const text = await getCenterLabelText(page);
  const parsed = parseCenterLabel(text);
  if (!parsed) throw new Error(`Could not parse center label: "${text}"`);
  return { text, minutes: toAbsoluteMinutes(parsed) };
}

async function getSvgGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.select-none');
    if (!svg) throw new Error('Timeline SVG not found');
    const rect = svg.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + 100,
    };
  });
}

// ─── MutationObserver-based label recording ────────────────────────────────────

/**
 * Inject a MutationObserver into the page that records EVERY text change to
 * .date-label-center with performance.now() timestamps. This catches changes
 * that happen within a single rAF that polling would miss.
 */
async function startLabelRecording(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as any).__labelLog = [];
    (window as any).__labelObserver?.disconnect();
    const el = document.querySelector('.date-label-center');
    if (!el) return;
    // Record current value as baseline
    (window as any).__labelLog.push({
      text: el.textContent ?? '',
      time: performance.now(),
    });
    const observer = new MutationObserver(() => {
      (window as any).__labelLog.push({
        text: el.textContent ?? '',
        time: performance.now(),
      });
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    (window as any).__labelObserver = observer;
  });
}

/** Flush the recorded label changes and return them. Clears the log. */
async function flushLabelRecording(page: import('@playwright/test').Page): Promise<
  Array<{ text: string; time: number }>
> {
  return page.evaluate(() => {
    const log = (window as any).__labelLog ?? [];
    (window as any).__labelLog = [];
    // Record current value as the final sample
    const el = document.querySelector('.date-label-center');
    if (el) {
      log.push({ text: el.textContent ?? '', time: performance.now() });
    }
    return log;
  });
}

async function stopLabelRecording(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as any).__labelObserver?.disconnect();
    (window as any).__labelObserver = null;
  });
}

/**
 * Given a reference position in minutes and a raw label log, compute the worst
 * drift from the reference across all logged changes.
 */
function analyzeRecording(
  referenceMinutes: number,
  log: Array<{ text: string; time: number }>,
): {
  worstDrift: number;
  worstEntry: { text: string; time: number; minutes: number };
  entries: Array<{ text: string; time: number; minutes: number | null }>;
} {
  const entries = log.map(e => ({ ...e, minutes: labelToMinutes(e.text) }));
  let worstDrift = 0;
  let worstEntry = { text: '', time: 0, minutes: 0 };

  for (const e of entries) {
    if (e.minutes === null) continue;
    const drift = Math.abs(e.minutes - referenceMinutes);
    if (drift > worstDrift) {
      worstDrift = drift;
      worstEntry = { text: e.text, time: e.time, minutes: e.minutes };
    }
  }
  return { worstDrift, worstEntry, entries };
}

// ─── Zoom & Drag helpers ───────────────────────────────────────────────────────

async function zoomAllTheWayOut(page: import('@playwright/test').Page, cx: number, cy: number) {
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
}

async function dragTimeline(
  page: import('@playwright/test').Page,
  startX: number,
  startY: number,
  distancePx: number,
  steps = 10,
) {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let s = 1; s <= steps; s++) {
    await page.mouse.move(startX + (distancePx * s) / steps, startY);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  // Wait just past zoom-end debounce (150ms)
  await page.waitForTimeout(250);
}

// A visible snap — even a single-frame flash — is a bug. 30 min at 3-day zoom
// is ~0.7% of the viewport, which is barely perceptible. A multi-hour snap is
// what the user sees, and this threshold catches that.
const MAX_DRIFT_MINUTES = 30;

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Timeline multi-day zoom-out drag stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('svg.select-none .date-label-center', { timeout: 15_000 });
    await page.waitForTimeout(1500);
  });

  test('dragging at max zoom-out should not snap the center label at any point', async ({ page }) => {
    test.setTimeout(90_000);
    const geo = await getSvgGeometry(page);
    const { centerX, centerY, width } = geo;

    await zoomAllTheWayOut(page, centerX, centerY);

    const dragPx = Math.floor(width * 0.15);

    for (let i = 0; i < 4; i++) {
      const before = await getCenterLabelMinutes(page);

      await dragTimeline(page, centerX, centerY, dragPx);

      // Read the label RIGHT after drag ends — this is our anchor.
      const afterDrag = await getCenterLabelMinutes(page);

      expect(
        afterDrag.minutes,
        `Iteration ${i}: center should move backward. ` +
          `Before: "${before.text}", After: "${afterDrag.text}"`,
      ).toBeLessThan(before.minutes);

      // Start recording ALL label mutations, then wait for the async cascade.
      await startLabelRecording(page);
      await page.waitForTimeout(3500);
      const log = await flushLabelRecording(page);
      await stopLabelRecording(page);

      const analysis = analyzeRecording(afterDrag.minutes, log);

      // Build a compact trace for the error message
      const uniqueLabels = [...new Set(log.map(e => e.text))];
      const traceStr = uniqueLabels.join(' → ');

      expect(
        analysis.worstDrift,
        `Iteration ${i}: LABEL SNAP detected via MutationObserver!\n` +
          `  Post-drag anchor: "${afterDrag.text}" (${afterDrag.minutes}min)\n` +
          `  Worst mutation:   "${analysis.worstEntry.text}" (${analysis.worstEntry.minutes}min)\n` +
          `  Peak drift: ${analysis.worstDrift}min (max: ${MAX_DRIFT_MINUTES}min)\n` +
          `  Mutation count: ${log.length}\n` +
          `  Unique labels: ${traceStr}`,
      ).toBeLessThanOrEqual(MAX_DRIFT_MINUTES);
    }
  });

  test('repeated small drags should accumulate without snap-back', async ({ page }) => {
    test.setTimeout(90_000);
    const geo = await getSvgGeometry(page);
    const { centerX, centerY, width } = geo;

    await zoomAllTheWayOut(page, centerX, centerY);

    const start = await getCenterLabelMinutes(page);

    const smallDrag = Math.floor(width * 0.10);
    for (let i = 0; i < 5; i++) {
      await dragTimeline(page, centerX, centerY, smallDrag, 5);
    }

    const afterDrags = await getCenterLabelMinutes(page);

    const totalShift = start.minutes - afterDrags.minutes;
    expect(
      totalShift,
      `Expected cumulative backward shift ≥ 60min, got ${totalShift}min.\n` +
        `  Start: "${start.text}", End: "${afterDrags.text}"`,
    ).toBeGreaterThanOrEqual(60);

    // Record every mutation during settle window
    await startLabelRecording(page);
    await page.waitForTimeout(4500);
    const log = await flushLabelRecording(page);
    await stopLabelRecording(page);

    const analysis = analyzeRecording(afterDrags.minutes, log);
    const uniqueLabels = [...new Set(log.map(e => e.text))];

    expect(
      analysis.worstDrift,
      `SNAP-BACK via MutationObserver!\n` +
        `  Post-drags anchor: "${afterDrags.text}" (${afterDrags.minutes}min)\n` +
        `  Worst mutation:    "${analysis.worstEntry.text}" (${analysis.worstEntry.minutes}min)\n` +
        `  Peak drift: ${analysis.worstDrift}min (max: ${MAX_DRIFT_MINUTES}min)\n` +
        `  Mutation count: ${log.length}\n` +
        `  Unique labels: ${uniqueLabels.join(' → ')}`,
    ).toBeLessThanOrEqual(MAX_DRIFT_MINUTES);
  });

  test('large drags across day boundaries should not snap at any point', async ({ page }) => {
    test.setTimeout(120_000);
    const geo = await getSvgGeometry(page);
    const { centerX, centerY, width } = geo;

    await zoomAllTheWayOut(page, centerX, centerY);

    const startDay = parseCenterLabel(await getCenterLabelText(page))!.dayOfMonth;

    const largeDrag = Math.floor(width * 0.25);

    // Backward panning is now smooth/controlled (~4h per 25% drag) rather than jumpy, so
    // it takes ~5 drags to reliably cross midnight from an afternoon start. Use 6 to
    // guarantee a day-boundary crossing while still asserting no snap on every drag.
    for (let i = 0; i < 6; i++) {
      const beforeDrag = await getCenterLabelMinutes(page);

      await dragTimeline(page, centerX, centerY, largeDrag, 15);

      const afterDrag = await getCenterLabelMinutes(page);

      expect(
        afterDrag.minutes,
        `Large drag ${i}: didn't move backward.\n` +
          `  Before: "${beforeDrag.text}", After: "${afterDrag.text}"`,
      ).toBeLessThan(beforeDrag.minutes);

      // Record mutations during the full settle window
      await startLabelRecording(page);
      await page.waitForTimeout(4000);
      const log = await flushLabelRecording(page);
      await stopLabelRecording(page);

      const analysis = analyzeRecording(afterDrag.minutes, log);
      const uniqueLabels = [...new Set(log.map(e => e.text))];

      expect(
        analysis.worstDrift,
        `Large drag ${i}: SNAP after day-boundary crossing!\n` +
          `  Post-drag anchor: "${afterDrag.text}" (${afterDrag.minutes}min)\n` +
          `  Worst mutation:   "${analysis.worstEntry.text}" (${analysis.worstEntry.minutes}min)\n` +
          `  Peak drift: ${analysis.worstDrift}min\n` +
          `  Mutation count: ${log.length}\n` +
          `  Unique labels: ${uniqueLabels.join(' → ')}`,
      ).toBeLessThanOrEqual(MAX_DRIFT_MINUTES);
    }

    const endDay = parseCenterLabel(await getCenterLabelText(page))!.dayOfMonth;
    expect(
      endDay,
      `Expected to cross a day boundary (start: day ${startDay}, end: day ${endDay})`,
    ).not.toBe(startDay);
  });
});
