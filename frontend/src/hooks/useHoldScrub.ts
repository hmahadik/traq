import { useState, useCallback, useEffect, useRef } from 'react';
import { clamp } from '@/lib/utils';
import { isEditableTarget } from '@/hooks/useKeyboardNav';

// Fastest scrub cadence, roughly the OS key-repeat rate. Engines that keep up
// (Chrome) sit here for the whole hold.
const HOLD_STEP_FLOOR_MS = 33;
// Slowest cadence the pacer backs off to on an engine that can't keep up
const HOLD_STEP_CEILING_MS = 400;
// Held-key repeats arriving closer together than this were queued inside the
// engine while we painted — real OS repeats arrive tens of ms apart
const BACKLOG_ARRIVAL_MS = 8;
// Backlog depth tolerated before giving up frame rate to let the queue drain
const BACKLOG_TOLERANCE = 2;
// Clear the hold state when repeats go quiet without a keyup (missed keyup)
const HOLD_IDLE_RELEASE_MS = 300;
// Widest gap the decode pipeline will skip ahead by during a fast hold
const MAX_PREFETCH_STRIDE = 16;
// How much of a hold's learned backoff survives into the next hold, in
// multiples of the floor
const HOLD_INTERVAL_CARRYOVER = 3;
// Safety net for views where rAF is suspended (hidden tab); long enough to
// never beat a live rAF
const RAF_FALLBACK_MS = 250;

interface HoldScrubOptions {
  // Held keys are only listened for while this is true
  open: boolean;
  // Length of the list being scrubbed; navigation wraps around it
  count: number;
  initialIndex: number;
  // Fired when an index step is actually applied (not once per key repeat)
  onStep?: () => void;
  // Fired when a hold session ends, so callers can drop per-hold display state
  onHoldEnd?: () => void;
}

/**
 * Held-arrow-key navigation paced to what the engine can actually paint.
 *
 * Key repeats each count as one step — traversal velocity always matches the
 * OS key-repeat rate — but steps accumulate between paints and only the
 * coalesced jump is rendered. On engines that paint large images slower than
 * the repeat rate (WebKitGTK), this samples frames coarsely like a video
 * scrubber instead of building an event backlog that keeps flipping for
 * seconds after the key is released.
 *
 * Two signals set the cadence: an EMA of measured render+paint cost, and the
 * observed depth of the engine's key-event backlog.
 */
export function useHoldScrub({
  open,
  count,
  initialIndex,
  onStep,
  onHoldEnd,
}: HoldScrubOptions) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isHolding, setIsHolding] = useState(false);

  // Read through refs so a caller passing inline arrows doesn't reinstall the
  // key listeners on every render
  const onStepRef = useRef(onStep);
  const onHoldEndRef = useRef(onHoldEnd);
  const countRef = useRef(count);
  useEffect(() => {
    onStepRef.current = onStep;
    onHoldEndRef.current = onHoldEnd;
    countRef.current = count;
  });

  // Frames travelled per painted frame, so the decode pipeline prefetches what
  // will actually be shown instead of every frame flown past
  const strideRef = useRef(1);

  const pendingStepsRef = useRef(0);
  const stepFrameRef = useRef<number | null>(null);
  const stepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // EMA of how long one navigation render+paint actually takes on this engine
  const frameCostRef = useRef(16);
  const lastApplyAtRef = useRef(0);
  // Learned safe paint cadence, and the observed depth of the engine's key
  // backlog that drives it
  const stepIntervalRef = useRef(HOLD_STEP_FLOOR_MS);
  const arrivalRef = useRef({ lastAt: 0, depth: 0, deepest: 0 });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledSteps = useCallback(() => {
    if (stepFrameRef.current !== null) {
      cancelAnimationFrame(stepFrameRef.current);
      stepFrameRef.current = null;
    }
    if (stepTimeoutRef.current !== null) {
      clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
  }, []);

  const applyPendingSteps = useCallback(() => {
    cancelScheduledSteps();
    const steps = pendingStepsRef.current;
    pendingStepsRef.current = 0;
    if (steps === 0) return;
    const appliedAt = performance.now();
    lastApplyAtRef.current = appliedAt;
    strideRef.current = clamp(
      strideRef.current * 0.5 + Math.abs(steps) * 0.5,
      1,
      MAX_PREFETCH_STRIDE
    );
    setCurrentIndex((prev) => {
      const total = countRef.current;
      if (total === 0) return prev;
      return (((prev + steps) % total) + total) % total;
    });
    onStepRef.current?.();

    // Repeats that arrived back-to-back were sitting in the engine's queue
    // while the previous frame painted. That backlog is exactly what keeps a
    // gallery flipping after keyup, so trade frame rate away until it clears
    // and take the frame rate back as soon as it does. Chrome never bursts, so
    // it decays to the floor and stays there.
    const arrival = arrivalRef.current;
    if (arrival.deepest > BACKLOG_TOLERANCE) {
      stepIntervalRef.current = Math.min(HOLD_STEP_CEILING_MS, stepIntervalRef.current * 1.5);
    } else if (arrival.deepest <= 1) {
      stepIntervalRef.current = Math.max(HOLD_STEP_FLOOR_MS, stepIntervalRef.current * 0.8);
    }
    arrival.deepest = 0;

    // This rAF fires after the frame containing our update paints, so the
    // elapsed time approximates the true render+paint cost on this engine
    requestAnimationFrame(() => {
      const cost = performance.now() - appliedAt;
      frameCostRef.current = frameCostRef.current * 0.7 + Math.min(cost, 300) * 0.3;
    });
  }, [cancelScheduledSteps]);

  const stepBy = useCallback(
    (steps: number) => {
      pendingStepsRef.current += steps;
      if (stepTimeoutRef.current !== null) return;
      // Pace to the cadence the pacer has learned is safe, and never aim
      // faster than a frame actually takes on this engine.
      const minInterval = Math.max(
        stepIntervalRef.current,
        Math.min(frameCostRef.current, HOLD_STEP_CEILING_MS),
        HOLD_STEP_FLOOR_MS
      );
      const wait = minInterval - (performance.now() - lastApplyAtRef.current);
      if (wait > 0) {
        stepTimeoutRef.current = setTimeout(applyPendingSteps, wait);
      } else {
        stepFrameRef.current = requestAnimationFrame(applyPendingSteps);
        stepTimeoutRef.current = setTimeout(applyPendingSteps, RAF_FALLBACK_MS);
      }
    },
    [applyPendingSteps]
  );

  const goToPrevious = useCallback(() => stepBy(-1), [stepBy]);
  const goToNext = useCallback(() => stepBy(1), [stepBy]);

  // Hold-to-scrub: held-key repeats step directly but are rate-capped to the
  // engine's measured frame cost. Over-rate repeats are consumed for free —
  // no paint — so the engine's serialized key queue (WebKitGTK delivers one
  // key event per main-thread turn) drains as fast as it fills, and the keyup
  // arrives about one frame after the finger lifts. No timers to run away.
  useEffect(() => {
    if (!open) return;

    const endHold = () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      const arrival = arrivalRef.current;
      arrival.lastAt = 0;
      arrival.depth = 0;
      arrival.deepest = 0;
      strideRef.current = 1;
      // Keep a hint of what this engine needed, but not the full backoff: a
      // stale ceiling would spend the next hold decaying instead of scrubbing
      stepIntervalRef.current = Math.min(
        stepIntervalRef.current,
        HOLD_STEP_FLOOR_MS * HOLD_INTERVAL_CARRYOVER
      );
      onHoldEndRef.current?.();
      setIsHolding(false);
    };

    // Keep the scrub-proxy display active while repeats flow; decay shortly
    // after they stop in case the keyup never arrives (focus loss mid-hold)
    const refreshHolding = () => {
      setIsHolding(true);
      if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        setIsHolding(false);
      }, HOLD_IDLE_RELEASE_MS);
    };

    const directionForKey = (key: string) =>
      key === 'ArrowRight' || key === 'l' ? 1 : key === 'ArrowLeft' || key === 'h' ? -1 : 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = directionForKey(event.key);
      if (direction === 0 || isEditableTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat) {
        // Every repeat counts one step — traversal velocity always matches
        // the OS key-repeat rate — but the coalescer decides how often the
        // accumulated jump is painted
        const arrival = arrivalRef.current;
        const now = performance.now();
        arrival.depth = now - arrival.lastAt <= BACKLOG_ARRIVAL_MS ? arrival.depth + 1 : 1;
        arrival.lastAt = now;
        if (arrival.depth > arrival.deepest) arrival.deepest = arrival.depth;
        refreshHolding();
      }
      stepBy(direction);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (directionForKey(event.key) === 0) return;
      endHold();
      // A keyup can't have repeats queued behind it, so land the last owed
      // step at once rather than waiting out the pacing interval
      if (pendingStepsRef.current !== 0) applyPendingSteps();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      endHold();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [open, stepBy, applyPendingSteps]);

  // Drop any queued steps when the gallery closes or unmounts
  useEffect(() => {
    if (!open) {
      pendingStepsRef.current = 0;
      cancelScheduledSteps();
    }
    return cancelScheduledSteps;
  }, [open, cancelScheduledSteps]);

  // Reset position when the caller points at a new starting frame
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  return {
    currentIndex,
    setCurrentIndex,
    isHolding,
    goToPrevious,
    goToNext,
    strideRef,
  };
}
