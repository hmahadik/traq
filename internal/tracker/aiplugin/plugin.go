// Package aiplugin defines the interface AI coding session trackers implement.
// Each plugin (claude, opencode) reads from an external on-disk data source
// and returns normalized events that AITracker persists to storage.
package aiplugin

import (
	"context"
	"time"

	"traq/internal/storage"
)

// AIEvent is the in-memory representation of one atomic event from an AI
// tool's log. It is not the same as storage.AIEvent (which has an int64
// timestamp and DB id); AITracker converts and persists these.
type AIEvent struct {
	Tool       string // "claude" | "opencode"
	SessionID  string // tool's native session ID
	ProjectDir string // absolute path or "" if unknown
	Timestamp  time.Time
	Kind       string // "user_prompt" | "assistant_turn" | "tool_use"
	FilePath   string // source JSONL path (claude) or "" (opencode)
	// Offset is the byte position *after* this event within FilePath.
	// Claude sets this so AITracker can persist source_offset; opencode
	// leaves it zero.
	Offset int64
	// Content is the raw user prompt text for user_prompt events, empty
	// otherwise. Stored verbatim (no server-side truncation).
	Content string
}

// AIPlugin is a single source of AI activity.
type AIPlugin interface {
	Name() string
	Available() bool
	Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error)
}
