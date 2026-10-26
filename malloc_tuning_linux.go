//go:build linux

package main

/*
#include <malloc.h>
*/
import "C"

// Pin glibc's mmap threshold so large C allocations (libwebp's per-frame
// YUV and encoder buffers, ~20-40 MB on a 5K display) are always served by
// mmap and returned to the OS on free.
//
// Left alone, glibc raises the threshold dynamically (up to 32 MB) after the
// first large free, so those buffers land in malloc arenas instead. Because
// goroutines hop between OS threads, each capture can run in a different
// arena, and every arena retains roughly one encode's working set. Over days
// of uptime this grew the process to ~800 MB. Setting the threshold explicitly
// disables the dynamic adjustment.
func init() {
	C.mallopt(C.M_MMAP_THRESHOLD, 1<<20)
}
