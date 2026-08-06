import { useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryKeys } from '@/api/hooks';
import type { Screenshot } from '@/types';

// Frames pre-loaded ahead of the current index in the direction of travel
const LOOKAHEAD = 6;
// Frames kept ready behind, so reversing direction is instant
const LOOKBEHIND = 2;
// Frames kept warm; evicted farthest-from-current first
const MAX_CACHED_IMAGES = 16;
// Frames that hold a decoded full-resolution bitmap. Captures are large — a
// stacked multi-monitor grab runs to 2880x5120, ~59 MB decoded — so only the
// frames that could be shown at rest keep one. Everything else keeps just its
// scrub proxy and the compressed blob, which is what fast flipping reads.
const FULLRES_RADIUS = 1;
// Concurrent fetch+decode operations — bounds total load regardless of key-repeat rate
const MAX_PARALLEL_LOADS = 2;
// Thumbnails are tiny, so more can be in flight without starving anything
const MAX_PARALLEL_THUMBS = 8;
// Thumbnails kept decoded; each is only a couple of hundred KB in memory
const MAX_CACHED_THUMBS = 48;
// Frames on either side that always get a thumbnail, whatever the stride
const THUMB_DENSE_RADIUS = 2;

// Longest edge of the scrub proxy. Painting a fresh 4K bitmap costs ~115ms in
// software-rendered WebKitGTK, which serializes keyboard delivery behind each
// frame; a quarter-area canvas paints in a fraction of that, letting held-key
// events drain at key-repeat rate. The full-res image is shown at rest.
export const PROXY_MAX_DIMENSION = 1200;

export interface ScrubCacheEntry {
  // Object URL over an in-memory Blob: display reuses the exact bytes we
  // pre-decoded, independent of engine HTTP-cache behavior (WebKitGTK does
  // not reliably reuse responses served via Wails' custom URI scheme)
  url: string;
  // Decoded full-resolution bitmap, shown when settled. Released on frames
  // that travel outside FULLRES_RADIUS; the blob url still renders them.
  image: HTMLImageElement | null;
  // Pre-scaled copy shown while scrubbing; null when the source is small or
  // canvas is unavailable
  proxy: HTMLCanvasElement | null;
}

// What the viewer can draw for one frame, best copy first. During a fast hold
// only `thumb` is usually ready; at rest the full-res bitmap is. Dimensions
// come off whichever element is drawn, so no copy is carried here.
export interface ScrubFrame {
  url: string | null;
  image: HTMLImageElement | null;
  proxy: HTMLCanvasElement | null;
  thumb: HTMLImageElement | null;
}

function makeScrubProxy(image: HTMLImageElement): HTMLCanvasElement | null {
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestEdge || longestEdge <= PROXY_MAX_DIMENSION) return null;
  const scale = PROXY_MAX_DIMENSION / longestEdge;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  // A 15-megapixel source downscales several times faster on the low-quality
  // sampler, and the result is only ever shown in motion
  context.imageSmoothingQuality = 'low';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Drop decoded full-res bitmaps the user has travelled away from. Their proxy
// and blob stay cached, so scrubbing back over them is still instant.
// Membership in the tiny keep-window is all this needs, so it never builds an
// index over the whole screenshot list — it runs on every painted frame.
function releaseDistantFullRes(
  cache: Map<number, ScrubCacheEntry>,
  screenshots: Screenshot[],
  currentIndex: number
) {
  if (cache.size === 0) return;
  const keepIds = new Set<number>();
  for (let offset = -FULLRES_RADIUS; offset <= FULLRES_RADIUS; offset++) {
    const screenshot = screenshots[currentIndex + offset];
    if (screenshot) keepIds.add(screenshot.id);
  }
  for (const [id, entry] of cache) {
    // Without a proxy the full-res bitmap is the only copy we can display
    if (!entry.image || !entry.proxy) continue;
    if (!keepIds.has(id)) cache.set(id, { ...entry, image: null });
  }
}

function clearCache(cache: Map<number, ScrubCacheEntry>) {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  cache.clear();
}

function waitForLoad(image: HTMLImageElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) {
      resolve();
      return;
    }
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image failed to load'));
  });
}

// decode() keeps the bitmap off the main thread, but it can reject spuriously
// (e.g. memory pressure) and jsdom doesn't implement it at all
async function decodeImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  if (typeof image.decode === 'function') {
    await image.decode().catch(() => waitForLoad(image));
  } else {
    await waitForLoad(image);
  }
  return image;
}

// Trim a cache back to `max`, dropping the entries farthest from the current
// frame first. Shared by the thumbnail and full-res caches, which differ only
// in their cap and in whether eviction has to release an object URL.
function evictDistant<T>(
  cache: Map<number, T>,
  indexById: Map<number, number>,
  currentIndex: number,
  max: number,
  dispose?: (entry: T) => void
) {
  if (cache.size <= max) return;
  const idsByDistance = [...cache.keys()].sort(
    (a, b) =>
      Math.abs((indexById.get(a) ?? Infinity) - currentIndex) -
      Math.abs((indexById.get(b) ?? Infinity) - currentIndex)
  );
  while (cache.size > max && idsByDistance.length > 0) {
    const id = idsByDistance.pop() as number;
    const entry = cache.get(id);
    cache.delete(id);
    if (entry !== undefined) dispose?.(entry);
  }
}

// Returns whatever is ready for this frame, with pre-decoded elements:
// displaying these exact nodes lets the engine reuse decoded bitmaps
// (WebKitGTK re-decodes when a *different* <img> merely shares the URL).
// A thumbnail-only frame is still a frame — during a fast hold it's usually
// the only thing that can arrive in time.
function makeFrameGetter(
  cacheRef: { current: Map<number, ScrubCacheEntry> },
  thumbCacheRef: { current: Map<number, HTMLImageElement> }
) {
  return (id: number): ScrubFrame | null => {
    const entry = cacheRef.current.get(id);
    const thumb = thumbCacheRef.current.get(id) ?? null;
    if (!entry) return thumb ? { url: null, image: null, proxy: null, thumb } : null;
    return { ...entry, thumb };
  };
}

/**
 * Decode-ahead cache for flipping through full-res screenshots at key-repeat
 * speed. Works like a video scrubber: a latest-wins priority queue loads the
 * current frame first, then frames ahead in the direction of travel, with
 * bounded concurrency. Frames the user has flown past go stale in the queue
 * and are never fetched, so holding a key can't flood the backend.
 */
export function useScrubImageCache(
  screenshots: Screenshot[],
  currentIndex: number,
  enabled: boolean,
  // How many frames the viewer travels between painted frames. Decoding a
  // 15-megapixel capture costs ~130ms, so fetching every frame a fast hold
  // passes over spends the whole budget on frames nobody ever sees; spacing
  // the lookahead by the paint cadence decodes only frames that get shown.
  strideRef: { current: number }
) {
  const queryClient = useQueryClient();
  const cacheRef = useRef(new Map<number, ScrubCacheEntry>());
  const inFlightRef = useRef(new Set<number>());
  const currentIndexRef = useRef(currentIndex);
  const prevIndexRef = useRef(currentIndex);
  const directionRef = useRef(1);
  const enabledRef = useRef(enabled);
  const screenshotsRef = useRef(screenshots);
  // Distance ranking for eviction needs id→index. Rebuilt only when the list
  // identity changes, not on every load: it is O(list) and eviction runs
  // several times per painted frame.
  const indexByIdRef = useRef(new Map<number, number>());
  const thumbCacheRef = useRef(new Map<number, HTMLImageElement>());
  const thumbInFlightRef = useRef(new Set<number>());
  // Bumped whenever the cache is torn down. Loads already past their first
  // await check it before spending a decode on — or caching bytes into — a
  // cache nobody is looking at any more.
  const generationRef = useRef(0);
  const [, rerender] = useReducer((c: number) => c + 1, 0);

  const discardCaches = useCallback(() => {
    generationRef.current += 1;
    clearCache(cacheRef.current);
    thumbCacheRef.current.clear();
    thumbInFlightRef.current.clear();
  }, []);

  // Strip thumbnails are ~4KB and decode in about a millisecond, so they can
  // keep up with any hold. They're what makes a fast scrub actually move:
  // full-res frames arrive far too slowly to land on every painted frame.
  const loadThumb = useCallback(
    async (id: number, priority = false) => {
      // Dedup against in-flight decodes synchronously. Checking this only
      // after the await let every pump re-enter for ids already loading — 5x
      // the query work on exactly the slow engine this cache exists for.
      if (thumbCacheRef.current.has(id) || thumbInFlightRef.current.has(id)) return;
      const generation = generationRef.current;
      // Resolve the path even if the decode queue is full: it is deduplicated
      // and cached forever, and the plain <img> fallback reads this same query
      // key when every decode slot is stalled
      const path = await queryClient.fetchQuery({
        queryKey: queryKeys.screenshots.thumbnail(id),
        queryFn: () => api.screenshots.getThumbnail(id),
        staleTime: Infinity,
      });
      if (!path || generation !== generationRef.current) return;
      if (thumbCacheRef.current.has(id) || thumbInFlightRef.current.has(id)) return;
      // The frame on screen may always start; the queue behind it is bounded
      const limit = priority ? MAX_PARALLEL_THUMBS + 1 : MAX_PARALLEL_THUMBS;
      if (thumbInFlightRef.current.size >= limit) return;
      thumbInFlightRef.current.add(id);
      try {
        const image = await decodeImage(path);
        if (generation !== generationRef.current) return;
        thumbCacheRef.current.set(id, image);
        evictDistant(
          thumbCacheRef.current,
          indexByIdRef.current,
          currentIndexRef.current,
          MAX_CACHED_THUMBS
        );
        if (screenshotsRef.current[currentIndexRef.current]?.id === id) {
          rerender();
        }
      } catch (error) {
        console.debug('Scrub cache: failed to load thumbnail', id, error);
      } finally {
        thumbInFlightRef.current.delete(id);
      }
    },
    [queryClient]
  );

  const loadFullRes = useCallback(
    async (id: number) => {
      const generation = generationRef.current;
      try {
        const path = await queryClient.fetchQuery({
          queryKey: queryKeys.screenshots.image(id),
          queryFn: () => api.screenshots.getScreenshotImage(id),
          staleTime: Infinity,
        });
        if (!path || generation !== generationRef.current) return;
        // Pull the bytes into memory once; display then reuses this exact Blob
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`screenshot fetch returned ${response.status}`);
        }
        const objectUrl = URL.createObjectURL(await response.blob());
        // Everything past here is expensive — a 15-megapixel decode plus a
        // main-thread downscale — and pointless once the cache has been torn
        // down, which is exactly what closing the gallery mid-load does
        if (generation !== generationRef.current) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        let image: HTMLImageElement;
        try {
          image = await decodeImage(objectUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          throw error;
        }
        if (generation !== generationRef.current) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        cacheRef.current.set(id, {
          url: objectUrl,
          image,
          proxy: makeScrubProxy(image),
        });
        evictDistant(
          cacheRef.current,
          indexByIdRef.current,
          currentIndexRef.current,
          MAX_CACHED_IMAGES,
          (entry) => URL.revokeObjectURL(entry.url)
        );
        releaseDistantFullRes(cacheRef.current, screenshotsRef.current, currentIndexRef.current);
        const current = screenshotsRef.current[currentIndexRef.current];
        if (current?.id === id) {
          rerender();
        }
      } catch (error) {
        console.debug('Scrub cache: failed to load screenshot', id, error);
      } finally {
        inFlightRef.current.delete(id);
        pumpRef.current();
      }
    },
    [queryClient]
  );

  const pump = useCallback(() => {
    if (!enabledRef.current) return;
    const list = screenshotsRef.current;
    const index = currentIndexRef.current;
    const direction = directionRef.current;
    const stride = Math.max(1, Math.round(strideRef.current));
    const priorityOrder: number[] = [index];
    for (let step = 1; step <= LOOKAHEAD; step++) {
      priorityOrder.push(index + step * stride * direction);
    }
    for (let step = 1; step <= LOOKBEHIND; step++) {
      priorityOrder.push(index - step * stride * direction);
    }
    // Thumbnails cover both the frames we predict and the ones immediately
    // around us, because a stride is a prediction and holds don't land exactly
    // on it. Whatever the hold lands on, something is ready to show.
    const thumbTargets = new Set<number>(priorityOrder);
    for (let offset = -THUMB_DENSE_RADIUS; offset <= THUMB_DENSE_RADIUS; offset++) {
      thumbTargets.add(index + offset);
    }
    for (const i of thumbTargets) {
      const screenshot = list[i];
      if (screenshot) void loadThumb(screenshot.id, i === index);
    }

    for (let rank = 0; rank < priorityOrder.length; rank++) {
      const screenshot = list[priorityOrder[rank]];
      // The frame on screen right now outranks the queue: without a reserved
      // slot it waits behind two 130ms decodes of frames we've already left
      const isCurrent = rank === 0;
      const limit = isCurrent ? MAX_PARALLEL_LOADS + 1 : MAX_PARALLEL_LOADS;
      if (inFlightRef.current.size >= limit) {
        if (isCurrent) continue;
        return;
      }
      if (!screenshot) continue;
      if (cacheRef.current.has(screenshot.id) || inFlightRef.current.has(screenshot.id)) continue;
      inFlightRef.current.add(screenshot.id);
      void loadFullRes(screenshot.id);
    }
  }, [loadFullRes, loadThumb, strideRef]);

  const pumpRef = useRef(pump);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const indexById = useMemo(
    () => new Map(screenshots.map((s, i) => [s.id, i])),
    [screenshots]
  );

  // Drop the caches when the screenshot set changes (gallery reused across sessions)
  const listKey =
    screenshots.length > 0
      ? `${screenshots.length}:${screenshots[0].id}:${screenshots[screenshots.length - 1].id}`
      : 'empty';
  useEffect(() => {
    discardCaches();
  }, [listKey, discardCaches]);

  // Release all object URLs on unmount
  useEffect(() => {
    return () => discardCaches();
  }, [discardCaches]);

  useEffect(() => {
    enabledRef.current = enabled;
    screenshotsRef.current = screenshots;
    indexByIdRef.current = indexById;
    if (!enabled) {
      discardCaches();
      return;
    }
    const delta = currentIndex - prevIndexRef.current;
    if (delta !== 0) {
      // A jump longer than half the list is the gallery wrapping around an end
      const wrapped = Math.abs(delta) > screenshots.length / 2;
      directionRef.current = (delta > 0) !== wrapped ? 1 : -1;
      prevIndexRef.current = currentIndex;
    }
    currentIndexRef.current = currentIndex;
    releaseDistantFullRes(cacheRef.current, screenshots, currentIndex);
    pump();
  }, [enabled, currentIndex, screenshots, pump]);

  // Memoized with [], so it outlives every render. Built by a module-level
  // factory rather than inline, so its scope holds the two cache refs and not
  // the whole first render (screenshots, queryClient, and their siblings).
  return useMemo(() => makeFrameGetter(cacheRef, thumbCacheRef), []);
}
