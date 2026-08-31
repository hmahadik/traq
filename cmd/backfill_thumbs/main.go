// Command backfill_thumbs regenerates stored screenshot thumbnails at a new width.
//
// Thumbnails are written next to their full-res source as "<base>_thumb.webp".
// Changing the capture-time thumbnail width only affects new screenshots, so
// this walks the existing library and re-encodes the older, smaller ones from
// their full-res source.
//
// It is safe to run while Traq is capturing: each thumbnail is written to a
// temp file in the same directory and moved into place with an atomic rename,
// so a reader ever sees either the old file or the complete new one. It is also
// safe to interrupt and re-run — thumbnails already at the target width are
// skipped, so a second run resumes where the first stopped.
//
//	go run ./cmd/backfill_thumbs -dry-run
//	go run ./cmd/backfill_thumbs
package main

import (
	"errors"
	"flag"
	"fmt"
	"image"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

const thumbSuffix = "_thumb.webp"

// options are the fully-resolved settings for one run.
type options struct {
	root    string
	width   int
	quality int
	workers int
	limit   int
	dryRun  bool
}

// outcome is what happened to a single thumbnail.
type outcome int

const (
	outcomeRewritten outcome = iota
	outcomeAlreadyWide
	outcomeNoSource
	outcomeFailed
)

// tally counts outcomes across all workers.
type tally struct {
	rewritten   atomic.Int64
	alreadyWide atomic.Int64
	noSource    atomic.Int64
	failed      atomic.Int64
	bytesBefore atomic.Int64
	bytesAfter  atomic.Int64
}

func (t *tally) record(o outcome) {
	switch o {
	case outcomeRewritten:
		t.rewritten.Add(1)
	case outcomeAlreadyWide:
		t.alreadyWide.Add(1)
	case outcomeNoSource:
		t.noSource.Add(1)
	case outcomeFailed:
		t.failed.Add(1)
	}
}

func main() {
	opts, err := parseFlags()
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(2)
	}

	thumbs, err := findThumbnails(opts.root)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error: scanning", opts.root+":", err)
		os.Exit(1)
	}
	if opts.limit > 0 && len(thumbs) > opts.limit {
		thumbs = thumbs[:opts.limit]
	}

	mode := "rewriting"
	if opts.dryRun {
		mode = "DRY RUN — inspecting"
	}
	fmt.Printf("%s %d thumbnails under %s at width %dpx (quality %d, %d workers)\n\n",
		mode, len(thumbs), opts.root, opts.width, opts.quality, opts.workers)

	start := time.Now()
	counts := run(thumbs, opts)
	report(counts, len(thumbs), time.Since(start), opts)

	if counts.failed.Load() > 0 {
		os.Exit(1)
	}
}

func parseFlags() (options, error) {
	defaultRoot, err := defaultScreenshotDir()
	if err != nil {
		return options{}, err
	}

	root := flag.String("dir", defaultRoot, "screenshot library root to walk")
	width := flag.Int("width", 400, "target thumbnail width in pixels")
	quality := flag.Int("quality", 80, "WebP encode quality (1-100); match the capture setting")
	workers := flag.Int("workers", defaultWorkers(), "concurrent encoders")
	limit := flag.Int("limit", 0, "process at most N thumbnails (0 = all); useful for a trial batch")
	dryRun := flag.Bool("dry-run", false, "report what would change without writing anything")
	flag.Parse()

	if *width <= 0 {
		return options{}, fmt.Errorf("width must be positive, got %d", *width)
	}
	if *quality <= 0 || *quality > 100 {
		return options{}, fmt.Errorf("quality must be in 1-100, got %d", *quality)
	}
	if *workers <= 0 {
		return options{}, fmt.Errorf("workers must be positive, got %d", *workers)
	}
	if info, err := os.Stat(*root); err != nil {
		return options{}, fmt.Errorf("cannot read -dir %s: %w", *root, err)
	} else if !info.IsDir() {
		return options{}, fmt.Errorf("-dir %s is not a directory", *root)
	}

	return options{
		root:    *root,
		width:   *width,
		quality: *quality,
		workers: *workers,
		limit:   *limit,
		dryRun:  *dryRun,
	}, nil
}

// defaultWorkers leaves headroom rather than saturating every core: each worker
// holds a decoded full-res frame, so the cap is about memory, not CPU.
func defaultWorkers() int {
	n := runtime.NumCPU() - 2
	if n < 1 {
		return 1
	}
	if n > 8 {
		return 8
	}
	return n
}

func defaultScreenshotDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot resolve home directory: %w", err)
	}
	return filepath.Join(home, ".local", "share", "traq", "screenshots"), nil
}

// findThumbnails collects every "*_thumb.webp" under root, sorted so progress
// output moves through the library in a predictable order.
func findThumbnails(root string) ([]string, error) {
	var found []string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if len(path) > len(thumbSuffix) && path[len(path)-len(thumbSuffix):] == thumbSuffix {
			found = append(found, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(found)
	return found, nil
}

// run fans the thumbnails out across workers and returns the outcome counts.
func run(thumbs []string, opts options) *tally {
	counts := &tally{}
	jobs := make(chan string)
	var done atomic.Int64

	var wg sync.WaitGroup
	for i := 0; i < opts.workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for path := range jobs {
				o, err := process(path, opts, counts)
				if err != nil {
					fmt.Fprintf(os.Stderr, "  ! %s: %v\n", path, err)
				}
				counts.record(o)

				if n := done.Add(1); n%2000 == 0 {
					fmt.Printf("  %d/%d processed (%d rewritten)\n", n, len(thumbs), counts.rewritten.Load())
				}
			}
		}()
	}

	for _, path := range thumbs {
		jobs <- path
	}
	close(jobs)
	wg.Wait()

	return counts
}

// process re-encodes one thumbnail from its full-res source. It never upscales:
// if the source is narrower than the target the thumbnail keeps the source's
// width, which is as much detail as exists.
func process(thumbPath string, opts options, counts *tally) (outcome, error) {
	sourcePath := thumbPath[:len(thumbPath)-len(thumbSuffix)] + ".webp"

	sourceInfo, err := os.Stat(sourcePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return outcomeNoSource, nil
		}
		return outcomeFailed, fmt.Errorf("stat source: %w", err)
	}
	// Zero-byte pairs exist in older libraries, left behind when a capture died
	// mid-write. There is no image to re-encode from, so leave them alone.
	if sourceInfo.IsDir() || sourceInfo.Size() == 0 {
		return outcomeNoSource, nil
	}

	// An unreadable existing thumbnail is not fatal: the source is what we
	// re-encode from, so treat it as width 0 and let this run repair it.
	currentWidth, err := imageWidth(thumbPath)
	if err != nil {
		currentWidth = 0
	}

	sourceWidth, err := imageWidth(sourcePath)
	if err != nil {
		return outcomeFailed, fmt.Errorf("read source header: %w", err)
	}

	target := opts.width
	if sourceWidth < target {
		target = sourceWidth
	}
	if currentWidth >= target {
		return outcomeAlreadyWide, nil
	}

	if opts.dryRun {
		return outcomeRewritten, nil
	}

	before, err := os.Stat(thumbPath)
	if err != nil {
		return outcomeFailed, fmt.Errorf("stat thumbnail: %w", err)
	}

	src, err := decodeWebP(sourcePath)
	if err != nil {
		return outcomeFailed, fmt.Errorf("decode source: %w", err)
	}

	thumb := imaging.Resize(src, target, 0, imaging.Lanczos)
	written, err := writeAtomic(thumbPath, thumb, opts.quality)
	if err != nil {
		return outcomeFailed, err
	}

	counts.bytesBefore.Add(before.Size())
	counts.bytesAfter.Add(written)
	return outcomeRewritten, nil
}

func decodeWebP(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return webp.Decode(f)
}

func imageWidth(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	cfg, err := webp.DecodeConfig(f)
	if err != nil {
		return 0, err
	}
	return cfg.Width, nil
}

// writeAtomic encodes the thumbnail beside its destination and renames it into
// place, so Traq never observes a half-written file. Returns the bytes written.
func writeAtomic(dest string, img image.Image, quality int) (int64, error) {
	tmp, err := os.CreateTemp(filepath.Dir(dest), ".backfill-*.webp")
	if err != nil {
		return 0, fmt.Errorf("create temp: %w", err)
	}
	tmpName := tmp.Name()

	// Any failure past this point leaves the original thumbnail untouched.
	cleanup := func() {
		tmp.Close()
		os.Remove(tmpName)
	}

	if err := webp.Encode(tmp, img, &webp.Options{Lossless: false, Quality: float32(quality)}); err != nil {
		cleanup()
		return 0, fmt.Errorf("encode: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return 0, fmt.Errorf("sync: %w", err)
	}

	info, err := tmp.Stat()
	if err != nil {
		cleanup()
		return 0, fmt.Errorf("stat temp: %w", err)
	}
	size := info.Size()

	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return 0, fmt.Errorf("close temp: %w", err)
	}
	// CreateTemp makes the file 0600; thumbnails are written 0644 at capture.
	if err := os.Chmod(tmpName, 0o644); err != nil {
		os.Remove(tmpName)
		return 0, fmt.Errorf("chmod temp: %w", err)
	}
	if err := os.Rename(tmpName, dest); err != nil {
		os.Remove(tmpName)
		return 0, fmt.Errorf("rename into place: %w", err)
	}

	return size, nil
}

// report prints the run summary.
func report(counts *tally, total int, elapsed time.Duration, opts options) {
	verb := "rewritten"
	if opts.dryRun {
		verb = "would be rewritten"
	}

	fmt.Printf("\ndone in %s — %d thumbnails scanned\n", elapsed.Round(time.Second), total)
	fmt.Printf("  %-22s %d\n", verb+":", counts.rewritten.Load())
	fmt.Printf("  %-22s %d\n", "already at width:", counts.alreadyWide.Load())
	fmt.Printf("  %-22s %d\n", "no full-res source:", counts.noSource.Load())
	fmt.Printf("  %-22s %d\n", "failed:", counts.failed.Load())

	if before, after := counts.bytesBefore.Load(), counts.bytesAfter.Load(); before > 0 {
		fmt.Printf("\n  thumbnail bytes: %.1f MB -> %.1f MB (%+.1f MB)\n",
			mb(before), mb(after), mb(after-before))
	}
	if counts.noSource.Load() > 0 {
		fmt.Printf("\n  note: %d thumbnails have no usable full-res source (missing, or a\n"+
			"        zero-byte file from a capture that died mid-write) and were left\n"+
			"        untouched — there is nothing to re-encode from.\n", counts.noSource.Load())
	}
}

func mb(bytes int64) float64 {
	return float64(bytes) / 1024 / 1024
}
