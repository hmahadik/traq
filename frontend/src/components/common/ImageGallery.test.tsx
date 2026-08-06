import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImageGallery } from './ImageGallery';
import type { Screenshot } from '@/types';

vi.mock('@/api/client', () => ({
  api: {
    screenshots: {
      getScreenshotImage: vi.fn((id: number) => Promise.resolve(`/images/full-${id}.png`)),
      getThumbnail: vi.fn((id: number) => Promise.resolve(`/images/thumb-${id}.png`)),
    },
  },
}));

import { api } from '@/api/client';

const getScreenshotImage = vi.mocked(api.screenshots.getScreenshotImage);

// jsdom images never fire load events, so the scrub pipeline needs a stand-in
// producing REAL <img> nodes (the cache mounts them into the DOM directly).
// autoResolve=true simulates a fast decoder; false simulates one that never
// finishes, which is how we verify the concurrency bound.
const mockImageConfig = { autoResolve: true };

function createMockImage(): HTMLImageElement {
  const img = document.createElement('img');
  let srcValue = '';
  Object.defineProperty(img, 'src', {
    get: () => srcValue,
    set(value: string) {
      srcValue = value;
      img.setAttribute('src', value);
      if (mockImageConfig.autoResolve) {
        Object.defineProperty(img, 'complete', { value: true, configurable: true });
        Object.defineProperty(img, 'naturalWidth', { value: 1920, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 1080, configurable: true });
        queueMicrotask(() => img.onload?.(new Event('load')));
      }
    },
  });
  return img;
}

function makeScreenshot(id: number): Screenshot {
  return {
    id,
    timestamp: 1735689600 + id * 30,
    filepath: `/screenshots/${id}.png`,
    dhash: `hash-${id}`,
    windowTitle: `Window ${id}`,
    appName: 'Chrome',
    windowClass: null,
    processPid: null,
    windowX: null,
    windowY: null,
    windowWidth: null,
    windowHeight: null,
    monitorName: null,
    monitorWidth: null,
    monitorHeight: null,
    sessionId: 1,
    createdAt: 1735689600 + id * 30,
  };
}

const screenshots = Array.from({ length: 30 }, (_, i) => makeScreenshot(i + 1));

function renderGallery() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImageGallery
        screenshots={screenshots}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  );
}

// jsdom has no 2d context; scrubbing paints into a canvas, so stand one up and
// record what gets drawn
const drawImage = vi.fn();
const contextStub = {
  drawImage,
  imageSmoothingQuality: 'low',
} as unknown as CanvasRenderingContext2D;
let getContextSpy: ReturnType<typeof vi.spyOn> | null = null;

function scrubCanvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>('[data-testid="scrub-canvas"]');
}

// Whatever frame the viewer is currently showing: the scrub canvas while
// flipping, otherwise the main image (strip thumbnails use object-cover)
function displayedFrameSrc(): string | null {
  const canvas = scrubCanvas();
  if (canvas && !canvas.classList.contains('hidden')) {
    return canvas.dataset.frameUrl ?? null;
  }
  const img = document.querySelector('img.object-contain');
  return img?.getAttribute('src') ?? null;
}

function counterValue(): number {
  return Number(screen.getByText(/^\d+ \/ 30$/).textContent?.split(' / ')[0]);
}

// Simulate holding an arrow key: OS key-repeat fires keydown roughly every 33ms
async function holdArrowRight(presses: number) {
  for (let i = 0; i < presses; i++) {
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(33);
    });
  }
}

async function settle(ms = 500) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('ImageGallery held-arrow-key navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', function () {
      return createMockImage();
    } as unknown as typeof Image);
    // The scrub cache pulls bytes into a Blob and displays via object URL;
    // jsdom implements neither, so pair them up: the fetched path rides along
    // on the fake blob and becomes a deterministic blob: URL
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        blob: async () => ({ __src: url }),
      }))
    );
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: { __src: string }) => `blob:${blob.__src}`),
      revokeObjectURL: vi.fn(),
    });
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(contextStub as unknown as RenderingContext);
    drawImage.mockClear();
    mockImageConfig.autoResolve = true;
    getScreenshotImage.mockClear();
  });

  afterEach(() => {
    getContextSpy?.mockRestore();
    vi.unstubAllGlobals();
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    vi.useRealTimers();
  });

  it('advances the counter on every key repeat', async () => {
    renderGallery();
    await settle();

    await holdArrowRight(9);

    expect(screen.getByText('10 / 30')).toBeInTheDocument();
  });

  it('coalesces event bursts into one update per animation frame', async () => {
    renderGallery();
    await settle();

    // A backlog burst: 10 keydowns land before the next animation frame
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    }
    // No frame has rendered yet, so the index must not have churned 10 times
    expect(screen.getByText('1 / 30')).toBeInTheDocument();

    // One frame later the whole burst applies as a single jump
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(screen.getByText('11 / 30')).toBeInTheDocument();
  });

  it('scrubs on a timer during a hold and stops the instant the key is released', async () => {
    renderGallery();
    await settle();

    // Fresh press steps once immediately
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText('2 / 30')).toBeInTheDocument();

    // OS repeat kicks in: repeat events only keep the session alive while the
    // internal timer advances frames
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40);
      });
    }
    expect(counterValue()).toBeGreaterThan(2);

    // Release: even stale repeats still draining afterwards must not navigate
    fireEvent.keyUp(window, { key: 'ArrowRight' });
    const atRelease = counterValue();
    await settle(600);

    expect(counterValue()).toBe(atRelease);
  });

  it('flips through full-res frames mid-scrub when the decoder keeps up', async () => {
    renderGallery();
    await settle();

    // Three rapid presses: 99ms elapsed, under the 150ms settle threshold,
    // so any full-res frame shown here came from the decode-ahead cache
    await holdArrowRight(3);

    expect(screen.getByText('4 / 30')).toBeInTheDocument();
    expect(displayedFrameSrc()).toBe('blob:/images/full-4.png');
  });

  it('scrubs through one reused canvas rather than swapping an element per frame', async () => {
    renderGallery();
    await settle();

    await holdArrowRight(1);
    const canvasAtStart = scrubCanvas();
    expect(canvasAtStart).not.toBeNull();
    expect(canvasAtStart?.classList.contains('hidden')).toBe(false);

    const drawsAtStart = drawImage.mock.calls.length;
    await holdArrowRight(3);

    // Same element, new frames painted into it
    expect(scrubCanvas()).toBe(canvasAtStart);
    expect(drawImage.mock.calls.length).toBeGreaterThan(drawsAtStart);
    expect(canvasAtStart?.dataset.frameUrl).toBe('blob:/images/full-5.png');
  });

  it('keeps repainting the frame during a hold even when full-res decoding falls behind', async () => {
    renderGallery();
    await settle();

    // Only the first full-res frame ever decodes; everything after it stalls,
    // which is what a 15-megapixel capture does against a held key
    mockImageConfig.autoResolve = false;
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight', repeat: i > 0 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40);
      });
      const frame = displayedFrameSrc();
      if (frame) seen.add(frame);
    }

    // The picture must track the counter, not freeze on one frame until keyup
    expect(seen.size).toBeGreaterThan(1);
    expect(counterValue()).toBeGreaterThan(4);
  });

  it('lands the last owed step the moment the key is released', async () => {
    renderGallery();
    await settle();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    expect(counterValue()).toBe(2);

    // A repeat inside the pacing interval is owed but not yet painted
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    });
    const beforeRelease = counterValue();

    // Releasing pays it immediately — no timer advance
    await act(async () => {
      fireEvent.keyUp(window, { key: 'ArrowRight' });
    });
    expect(counterValue()).toBe(3);
    expect(beforeRelease).toBeLessThanOrEqual(3);
  });

  it('bounds backend load by concurrency, not key-repeat rate, when decoding is slow', async () => {
    mockImageConfig.autoResolve = false;
    renderGallery();
    await settle();

    // Pipeline slots (3) are occupied by loads that never finish
    const callsAfterOpen = getScreenshotImage.mock.calls.length;
    expect(callsAfterOpen).toBeLessThanOrEqual(3);

    await holdArrowRight(15);

    // The frame on screen gets one reserved slot, so a single extra fetch may
    // start — but load never scales with how long the key is held
    expect(getScreenshotImage.mock.calls.length).toBeLessThanOrEqual(callsAfterOpen + 1);

    // The viewer degrades to the cached thumbnail instead of going blank
    expect(displayedFrameSrc()).toBe('/images/thumb-16.png');
  });

  it('shows the full-res image for the frame where navigation stops', async () => {
    renderGallery();
    await settle();

    await holdArrowRight(5);
    await settle();

    expect(screen.getByText('6 / 30')).toBeInTheDocument();
    expect(displayedFrameSrc()).toBe('blob:/images/full-6.png');
    expect(getScreenshotImage).toHaveBeenCalledWith(6);
  });
});
