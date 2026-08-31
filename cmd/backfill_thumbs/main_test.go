package main

import (
	"image"
	"image/color"
	"os"
	"path/filepath"
	"testing"

	"github.com/chai2010/webp"
)

// writeWebP creates a solid-colour WebP of the given size at path.
func writeWebP(t *testing.T, path string, width, height int) {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create %s: %v", path, err)
	}
	defer f.Close()

	if err := webp.Encode(f, img, &webp.Options{Lossless: false, Quality: 80}); err != nil {
		t.Fatalf("encode %s: %v", path, err)
	}
}

// pair writes a full-res source and its thumbnail, returning the thumbnail path.
func pair(t *testing.T, dir, base string, sourceWidth, thumbWidth int) string {
	t.Helper()

	source := filepath.Join(dir, base+".webp")
	thumb := filepath.Join(dir, base+thumbSuffix)
	writeWebP(t, source, sourceWidth, sourceWidth*9/16)
	writeWebP(t, thumb, thumbWidth, thumbWidth*9/16)
	return thumb
}

func testOptions(width int) options {
	return options{width: width, quality: 80, workers: 1}
}

func TestProcess(t *testing.T) {
	tests := []struct {
		name        string
		sourceWidth int
		thumbWidth  int
		targetWidth int
		want        outcome
		wantWidth   int // expected thumbnail width afterwards
	}{
		{
			name:        "widens an undersized thumbnail",
			sourceWidth: 1920,
			thumbWidth:  200,
			targetWidth: 400,
			want:        outcomeRewritten,
			wantWidth:   400,
		},
		{
			name:        "skips a thumbnail already at the target",
			sourceWidth: 1920,
			thumbWidth:  400,
			targetWidth: 400,
			want:        outcomeAlreadyWide,
			wantWidth:   400,
		},
		{
			name:        "skips a thumbnail wider than the target",
			sourceWidth: 1920,
			thumbWidth:  800,
			targetWidth: 400,
			want:        outcomeAlreadyWide,
			wantWidth:   800,
		},
		{
			name:        "never upscales past the source width",
			sourceWidth: 300,
			thumbWidth:  200,
			targetWidth: 400,
			want:        outcomeRewritten,
			wantWidth:   300,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			thumb := pair(t, dir, "120000_m0", tt.sourceWidth, tt.thumbWidth)

			got, err := process(thumb, testOptions(tt.targetWidth), &tally{})
			if err != nil {
				t.Fatalf("process returned error: %v", err)
			}
			if got != tt.want {
				t.Errorf("got outcome %v, want %v", got, tt.want)
			}

			width, err := imageWidth(thumb)
			if err != nil {
				t.Fatalf("read resulting thumbnail: %v", err)
			}
			if width != tt.wantWidth {
				t.Errorf("got thumbnail width %d, want %d", width, tt.wantWidth)
			}
		})
	}
}

func TestProcess_MissingSourceLeavesThumbnailAlone(t *testing.T) {
	dir := t.TempDir()
	thumb := filepath.Join(dir, "120000_m0"+thumbSuffix)
	writeWebP(t, thumb, 200, 113)

	before, err := os.ReadFile(thumb)
	if err != nil {
		t.Fatalf("read thumbnail: %v", err)
	}

	got, err := process(thumb, testOptions(400), &tally{})
	if err != nil {
		t.Fatalf("process returned error: %v", err)
	}
	if got != outcomeNoSource {
		t.Errorf("got outcome %v, want outcomeNoSource", got)
	}

	after, err := os.ReadFile(thumb)
	if err != nil {
		t.Fatalf("re-read thumbnail: %v", err)
	}
	if string(before) != string(after) {
		t.Error("thumbnail was modified despite having no full-res source")
	}
}

// Zero-byte pairs are left behind by captures that died mid-write. There is no
// image to re-encode from, so they must be skipped rather than reported failed.
func TestProcess_ZeroByteSourceIsSkipped(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(dir, "120000_m0.webp")
	thumb := filepath.Join(dir, "120000_m0"+thumbSuffix)

	for _, path := range []string{source, thumb} {
		if err := os.WriteFile(path, nil, 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}

	got, err := process(thumb, testOptions(400), &tally{})
	if err != nil {
		t.Fatalf("process returned error: %v", err)
	}
	if got != outcomeNoSource {
		t.Errorf("got outcome %v, want outcomeNoSource", got)
	}
}

// A corrupt thumbnail is recoverable as long as the source decodes: the source
// is what gets re-encoded, so the run should repair it rather than fail.
func TestProcess_CorruptThumbnailIsRepaired(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(dir, "120000_m0.webp")
	thumb := filepath.Join(dir, "120000_m0"+thumbSuffix)

	writeWebP(t, source, 1920, 1080)
	if err := os.WriteFile(thumb, []byte("not a webp"), 0o644); err != nil {
		t.Fatalf("write corrupt thumbnail: %v", err)
	}

	got, err := process(thumb, testOptions(400), &tally{})
	if err != nil {
		t.Fatalf("process returned error: %v", err)
	}
	if got != outcomeRewritten {
		t.Errorf("got outcome %v, want outcomeRewritten", got)
	}

	width, err := imageWidth(thumb)
	if err != nil {
		t.Fatalf("resulting thumbnail is not readable: %v", err)
	}
	if width != 400 {
		t.Errorf("got repaired width %d, want 400", width)
	}
}

func TestProcess_DryRunWritesNothing(t *testing.T) {
	dir := t.TempDir()
	thumb := pair(t, dir, "120000_m0", 1920, 200)

	before, err := os.ReadFile(thumb)
	if err != nil {
		t.Fatalf("read thumbnail: %v", err)
	}

	opts := testOptions(400)
	opts.dryRun = true

	got, err := process(thumb, opts, &tally{})
	if err != nil {
		t.Fatalf("process returned error: %v", err)
	}
	if got != outcomeRewritten {
		t.Errorf("got outcome %v, want outcomeRewritten (dry run reports intent)", got)
	}

	after, err := os.ReadFile(thumb)
	if err != nil {
		t.Fatalf("re-read thumbnail: %v", err)
	}
	if string(before) != string(after) {
		t.Error("dry run modified the thumbnail on disk")
	}
}

// A rewrite must leave no temp files behind and must keep the thumbnail
// readable at all times, since Traq may be capturing during the backfill.
func TestProcess_LeavesNoTempFiles(t *testing.T) {
	dir := t.TempDir()
	thumb := pair(t, dir, "120000_m0", 1920, 200)

	if _, err := process(thumb, testOptions(400), &tally{}); err != nil {
		t.Fatalf("process returned error: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read dir: %v", err)
	}
	if len(entries) != 2 {
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Errorf("got %d files %v, want exactly the source and thumbnail", len(entries), names)
	}
}

func TestProcess_PreservesReadablePermissions(t *testing.T) {
	dir := t.TempDir()
	thumb := pair(t, dir, "120000_m0", 1920, 200)

	if _, err := process(thumb, testOptions(400), &tally{}); err != nil {
		t.Fatalf("process returned error: %v", err)
	}

	info, err := os.Stat(thumb)
	if err != nil {
		t.Fatalf("stat thumbnail: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o644 {
		t.Errorf("got mode %o, want 644 — CreateTemp's 0600 must not leak through", perm)
	}
}

func TestFindThumbnails(t *testing.T) {
	root := t.TempDir()
	day := filepath.Join(root, "2026", "01", "05")
	if err := os.MkdirAll(day, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	pair(t, day, "000256", 1920, 200)
	pair(t, day, "000326_m1", 1920, 200)

	found, err := findThumbnails(root)
	if err != nil {
		t.Fatalf("findThumbnails: %v", err)
	}
	if len(found) != 2 {
		t.Fatalf("got %d thumbnails %v, want 2", len(found), found)
	}
	for _, path := range found {
		if filepath.Ext(path) != ".webp" || !hasSuffix(path, thumbSuffix) {
			t.Errorf("%s is not a thumbnail", path)
		}
	}
}

func hasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
