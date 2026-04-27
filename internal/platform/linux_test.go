//go:build linux

package platform

import (
	"errors"
	"io"
	"testing"

	"github.com/jezek/xgb/xproto"
)

func TestParseWindowID(t *testing.T) {
	tests := []struct {
		name string
		in   []byte
		want xproto.Window
	}{
		{"empty", nil, 0},
		{"short", []byte{0x01, 0x02}, 0},
		{"zero", []byte{0, 0, 0, 0}, 0},
		{"little-endian", []byte{0x78, 0x56, 0x34, 0x12}, xproto.Window(0x12345678)},
		{"trailing bytes ignored", []byte{0x04, 0x03, 0x02, 0x01, 0xff, 0xff}, xproto.Window(0x01020304)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseWindowID(tt.in); got != tt.want {
				t.Fatalf("parseWindowID(%v) = %#x, want %#x", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseCardinal(t *testing.T) {
	tests := []struct {
		name string
		in   []byte
		want int
	}{
		{"empty", nil, 0},
		{"short", []byte{0x01, 0x02, 0x03}, 0},
		{"pid 1234", []byte{0xd2, 0x04, 0x00, 0x00}, 1234},
		{"pid 65536", []byte{0x00, 0x00, 0x01, 0x00}, 65536},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseCardinal(tt.in); got != tt.want {
				t.Fatalf("parseCardinal(%v) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseWmClass(t *testing.T) {
	tests := []struct {
		name         string
		in           []byte
		wantApp      string
		wantClass    string
	}{
		{"empty", nil, "", ""},
		{"typical firefox", []byte("Navigator\x00Firefox\x00"), "Navigator", "Firefox"},
		{"typical chrome", []byte("google-chrome\x00Google-chrome\x00"), "google-chrome", "Google-chrome"},
		{"missing class", []byte("app-only\x00"), "app-only", ""},
		{"no null terminator", []byte("bare"), "bare", ""},
		{"empty instance", []byte("\x00ClassOnly\x00"), "", "ClassOnly"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotApp, gotClass := parseWmClass(tt.in)
			if gotApp != tt.wantApp || gotClass != tt.wantClass {
				t.Fatalf("parseWmClass(%q) = (%q, %q), want (%q, %q)",
					tt.in, gotApp, gotClass, tt.wantApp, tt.wantClass)
			}
		})
	}
}

func TestHandleXErr_ResetsOnEOF(t *testing.T) {
	l := &Linux{x11Ready: true}

	l.handleXErr(nil)
	if !l.x11Ready {
		t.Fatalf("handleXErr(nil) should not reset: x11Ready = false")
	}

	l.handleXErr(errors.New("BadWindow: invalid window parameter"))
	if !l.x11Ready {
		t.Fatalf("handleXErr(protocol error) should not reset: x11Ready = false")
	}

	l.handleXErr(io.EOF)
	if l.x11Ready {
		t.Fatalf("handleXErr(io.EOF) should reset: x11Ready = true")
	}
}

func TestHandleXErr_ResetsOnWrappedEOF(t *testing.T) {
	l := &Linux{x11Ready: true}
	wrapped := errors.New("get active window: " + io.EOF.Error())
	// Plain string-wrapped EOF should NOT reset (not the same error).
	l.handleXErr(wrapped)
	if !l.x11Ready {
		t.Fatalf("handleXErr with string-only EOF copy should not reset")
	}

	l.x11Ready = true
	// errors.Is-wrapped EOF should reset.
	l.handleXErr(&wrappedErr{err: io.EOF})
	if l.x11Ready {
		t.Fatalf("handleXErr with errors.Is-compatible EOF should reset")
	}
}

type wrappedErr struct{ err error }

func (w *wrappedErr) Error() string { return "wrapped: " + w.err.Error() }
func (w *wrappedErr) Unwrap() error { return w.err }
