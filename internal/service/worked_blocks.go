package service

import "sort"

// maxWorkedGapSeconds is the longest gap between consecutive activity that still
// counts as part of the same working block. Gaps up to this length (lunch, a
// meeting away from the desk, an AFK period) are included in worked time.
// Anything longer (overnight, machine suspended or shut down with no AFK
// event recorded, an afternoon out) splits the day into separate working
// blocks and is excluded — otherwise a 30-second blip at 00:46 followed by a
// 14h gap would report a 17-hour workday.
const maxWorkedGapSeconds int64 = 3 * 3600

// timeInterval is a half-open [Start, End) range in unix seconds.
type timeInterval struct {
	Start int64
	End   int64
}

// Seconds returns the interval length, never negative.
func (iv timeInterval) Seconds() int64 {
	if iv.End <= iv.Start {
		return 0
	}
	return iv.End - iv.Start
}

// workedSummary is the result of grouping activity into working blocks.
type workedSummary struct {
	// Blocks are the working blocks in chronological order. Each block spans
	// from its first to its last activity, including any internal gaps.
	Blocks []timeInterval
	// Primary is the longest block (earliest wins a tie), or nil if none. It is
	// what "start time" / "end time" should describe for the day.
	Primary *timeInterval
	// WorkedSeconds is the sum of all block spans.
	WorkedSeconds int64
	// First and Last are the literal earliest start and latest end across all
	// blocks (0 when there are no blocks).
	First int64
	Last  int64
}

// workedBlocks clamps intervals to [lo, hi], merges them in chronological
// order, and splits them into working blocks wherever the gap between
// consecutive activity exceeds maxGap. Intervals may be unsorted or overlap.
func workedBlocks(intervals []timeInterval, lo, hi int64, maxGap int64) workedSummary {
	clamped := clampIntervals(intervals, lo, hi)
	if len(clamped) == 0 {
		return workedSummary{}
	}

	blocks := []timeInterval{clamped[0]}
	for _, iv := range clamped[1:] {
		cur := &blocks[len(blocks)-1]
		if iv.Start-cur.End > maxGap {
			blocks = append(blocks, iv)
			continue
		}
		if iv.End > cur.End {
			cur.End = iv.End
		}
	}

	summary := workedSummary{
		Blocks: blocks,
		First:  blocks[0].Start,
		Last:   blocks[len(blocks)-1].End,
	}
	primaryIdx := 0
	for i, b := range blocks {
		summary.WorkedSeconds += b.Seconds()
		if b.Seconds() > blocks[primaryIdx].Seconds() {
			primaryIdx = i
		}
	}
	primary := blocks[primaryIdx]
	summary.Primary = &primary
	return summary
}

// clampIntervals returns a new, sorted slice of the intervals clipped to
// [lo, hi], dropping any that are empty after clipping.
func clampIntervals(intervals []timeInterval, lo, hi int64) []timeInterval {
	out := make([]timeInterval, 0, len(intervals))
	for _, iv := range intervals {
		start, end := iv.Start, iv.End
		if start < lo {
			start = lo
		}
		if end > hi {
			end = hi
		}
		if end > start {
			out = append(out, timeInterval{Start: start, End: end})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Start < out[j].Start })
	return out
}

// overlapSeconds returns how many seconds of iv fall inside block.
func overlapSeconds(iv, block timeInterval) int64 {
	start, end := iv.Start, iv.End
	if start < block.Start {
		start = block.Start
	}
	if end > block.End {
		end = block.End
	}
	if end <= start {
		return 0
	}
	return end - start
}
