import { test, expect } from '@playwright/test';

/**
 * Verifies the pan fast-path: during a pure pan, the dots layer is translated via a
 * single transform (GPU composite) instead of every rect's x being rewritten; on
 * release the transform is committed back into attributes.
 */

async function geo(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.select-none')!;
    const r = svg.getBoundingClientRect();
    return { centerX: r.x + r.width / 2, centerY: r.y + 130, width: r.width };
  });
}

function readState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.select-none')!;
    const pan = svg.querySelector('.dots-pan') as SVGGElement | null;
    const firstDot = svg.querySelector('.event-dot') as SVGRectElement | null;
    const firstBar = svg.querySelector('.event-bar') as SVGRectElement | null;
    return {
      panTransform: pan?.getAttribute('transform') ?? null,
      willChange: pan ? (pan.style as any).willChange || null : null,
      dotCount: svg.querySelectorAll('.event-dot').length,
      barCount: svg.querySelectorAll('.event-bar').length,
      firstDotX: firstDot?.getAttribute('x') ?? null,
      firstBarX: firstBar?.getAttribute('x') ?? null,
    };
  });
}

test('pan fast-path: translate during drag, commit on release', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('svg.select-none .event-dot', { timeout: 20_000 });
  await page.waitForTimeout(1500);

  const g = await geo(page);
  const before = await readState(page);
  console.log('BEFORE drag:', JSON.stringify(before));
  expect(before.dotCount, 'dots should render').toBeGreaterThan(0);
  expect(before.panTransform, 'no pan transform at rest').toBeFalsy();

  // Start a pure pan (left drag) but DON'T release yet.
  await page.mouse.move(g.centerX, g.centerY);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(g.centerX - i * 25, g.centerY);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(60); // let an rAF land

  const during = await readState(page);
  console.log('DURING drag:', JSON.stringify(during));

  // Fast-path engaged: the dots layer is translated...
  expect(during.panTransform, 'dots-pan should be translated mid-drag').toMatch(/translate\(\s*-?\d/);
  // ...and the rect attributes are UNCHANGED (we composited, didn't rewrite them).
  expect(during.firstDotX, 'dot x must NOT be rewritten during pan').toBe(before.firstDotX);

  await page.mouse.up();
  await page.waitForTimeout(400); // past the 150ms end-debounce + commit

  const after = await readState(page);
  console.log('AFTER release:', JSON.stringify(after));

  // Committed: transform cleared, positions baked into attributes.
  expect(after.panTransform, 'pan transform cleared on release').toBeFalsy();
  expect(after.willChange, 'will-change cleared on release').toBeFalsy();
  expect(after.firstDotX, 'dot x committed to new position after release').not.toBe(before.firstDotX);
  expect(after.dotCount, 'dots still present after commit').toBeGreaterThan(0);
});
