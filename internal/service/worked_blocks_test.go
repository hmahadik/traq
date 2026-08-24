package service

import (
	"testing"
)

const testHour int64 = 3600

func TestWorkedBlocks_Empty(t *testing.T) {
	got := workedBlocks(nil, 0, 24*testHour, maxWorkedGapSeconds)
	if got.WorkedSeconds != 0 || got.Primary != nil || got.First != 0 || got.Last != 0 {
		t.Errorf("empty input should produce zero summary, got %+v", got)
	}
}

func TestWorkedBlocks_SingleBlockIncludesShortGaps(t *testing.T) {
	// 09:00-10:00, 30m gap, 10:30-12:00, 1h AFK gap, 13:00-17:00 -> one block
	intervals := []timeInterval{
		{9 * testHour, 10 * testHour},
		{10*testHour + 1800, 12 * testHour},
		{13 * testHour, 17 * testHour},
	}
	got := workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)

	if got.WorkedSeconds != 8*testHour {
		t.Errorf("WorkedSeconds = %d, want %d", got.WorkedSeconds, 8*testHour)
	}
	if len(got.Blocks) != 1 {
		t.Fatalf("len(Blocks) = %d, want 1", len(got.Blocks))
	}
	if got.Primary == nil || got.Primary.Start != 9*testHour || got.Primary.End != 17*testHour {
		t.Errorf("Primary = %+v, want 09:00-17:00", got.Primary)
	}
}

func TestWorkedBlocks_LongGapSplitsBlocks(t *testing.T) {
	// Real-world shape: 30s blip at 00:46 (machine woke), 14h untracked gap
	// (machine off), then 14:47-17:47 of work.
	blip := int64(46*60 + 44)
	work := 14*testHour + 47*60 + 52
	intervals := []timeInterval{
		{blip, blip + 30},
		{work, work + 3*testHour},
	}
	got := workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)

	want := int64(30 + 3*testHour)
	if got.WorkedSeconds != want {
		t.Errorf("WorkedSeconds = %d, want %d (untracked gap must be excluded)", got.WorkedSeconds, want)
	}
	if len(got.Blocks) != 2 {
		t.Fatalf("len(Blocks) = %d, want 2", len(got.Blocks))
	}
	// Primary block is the longest one, not the first one
	if got.Primary == nil || got.Primary.Start != work || got.Primary.End != work+3*testHour {
		t.Errorf("Primary = %+v, want the 14:47-17:47 block", got.Primary)
	}
	// First/Last still report the literal first and last activity
	if got.First != blip || got.Last != work+3*testHour {
		t.Errorf("First/Last = %d/%d, want %d/%d", got.First, got.Last, blip, work+3*testHour)
	}
}

func TestWorkedBlocks_GapExactlyAtThresholdStaysJoined(t *testing.T) {
	intervals := []timeInterval{
		{9 * testHour, 10 * testHour},
		{10*testHour + maxWorkedGapSeconds, 11*testHour + maxWorkedGapSeconds},
	}
	got := workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)
	if len(got.Blocks) != 1 {
		t.Errorf("gap == threshold should stay in one block, got %d blocks", len(got.Blocks))
	}
	// One second over the threshold splits
	intervals[1].Start++
	got = workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)
	if len(got.Blocks) != 2 {
		t.Errorf("gap > threshold should split, got %d blocks", len(got.Blocks))
	}
}

func TestWorkedBlocks_ClampsToRangeAndDropsOutside(t *testing.T) {
	// Event from 23:00 previous day to 02:00 today, plus one entirely yesterday
	intervals := []timeInterval{
		{-testHour, 2 * testHour},
		{-5 * testHour, -4 * testHour},
	}
	got := workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)
	if got.WorkedSeconds != 2*testHour {
		t.Errorf("WorkedSeconds = %d, want %d", got.WorkedSeconds, 2*testHour)
	}
	if got.Primary == nil || got.Primary.Start != 0 || got.Primary.End != 2*testHour {
		t.Errorf("Primary = %+v, want 00:00-02:00", got.Primary)
	}
}

func TestWorkedBlocks_UnsortedAndOverlappingIntervals(t *testing.T) {
	// Out of order, with an overlap: 10:00-12:00 fully contains 10:30-11:00,
	// and 09:00-10:30 overlaps the start of it.
	intervals := []timeInterval{
		{10*testHour + 1800, 11 * testHour},
		{9 * testHour, 10*testHour + 1800},
		{10 * testHour, 12 * testHour},
	}
	got := workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)
	if got.WorkedSeconds != 3*testHour {
		t.Errorf("WorkedSeconds = %d, want %d", got.WorkedSeconds, 3*testHour)
	}
	if len(got.Blocks) != 1 {
		t.Errorf("len(Blocks) = %d, want 1", len(got.Blocks))
	}
}

func TestWorkedBlocks_PrimaryTieGoesToEarliest(t *testing.T) {
	intervals := []timeInterval{
		{9 * testHour, 12 * testHour},
		{16 * testHour, 19 * testHour},
	}
	got := workedBlocks(intervals, 0, 24*testHour, maxWorkedGapSeconds)
	if got.WorkedSeconds != 6*testHour {
		t.Errorf("WorkedSeconds = %d, want %d", got.WorkedSeconds, 6*testHour)
	}
	if got.Primary == nil || got.Primary.Start != 9*testHour {
		t.Errorf("Primary = %+v, want the earlier 09:00-12:00 block on a tie", got.Primary)
	}
}
