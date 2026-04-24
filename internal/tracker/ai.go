package tracker

import (
	"context"
	"log"
	"time"

	"traq/internal/storage"
	"traq/internal/tracker/aiplugin"
)

// AITracker polls a set of AIPlugins and persists the events they return.
// Safe to call Poll from at most one goroutine at a time.
type AITracker struct {
	store   *storage.Store
	plugins []aiplugin.AIPlugin
}

func NewAITracker(store *storage.Store, plugins []aiplugin.AIPlugin) *AITracker {
	return &AITracker{store: store, plugins: plugins}
}

// Poll queries every available plugin once and writes new events to storage.
// Errors from a single plugin do not stop other plugins.
func (t *AITracker) Poll() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, p := range t.plugins {
		if !p.Available() {
			continue
		}
		events, err := p.Poll(ctx, t.store)
		if err != nil {
			// Surface continuous plugin failures so they're debuggable. The
			// previous form swallowed errors silently, which masked e.g. a
			// malformed JSONL file that would never succeed on retry.
			log.Printf("AITracker: plugin %T poll failed: %v", p, err)
			continue
		}
		if len(events) == 0 {
			continue
		}
		if err := t.persist(events); err != nil {
			log.Printf("AITracker: persist events from %T: %v", p, err)
		}
	}
	return nil
}

// persist groups events by (tool, session) and upserts each session row with
// the last event's file offset, then bulk-inserts the events.
func (t *AITracker) persist(events []aiplugin.AIEvent) error {
	type key struct{ tool, session string }
	groups := map[key][]aiplugin.AIEvent{}
	order := []key{}
	for _, e := range events {
		k := key{e.Tool, e.SessionID}
		if _, seen := groups[k]; !seen {
			order = append(order, k)
		}
		groups[k] = append(groups[k], e)
	}

	for _, k := range order {
		g := groups[k]
		last := g[len(g)-1]

		var existing *storage.AISession
		if last.FilePath != "" {
			existing, _ = t.store.GetAISessionByFilePath(last.FilePath)
		}
		if existing == nil {
			existing, _ = t.store.GetAISessionByID(last.SessionID)
		}

		startedAt := g[0].Timestamp.Unix()
		existingCount := 0
		if existing != nil {
			startedAt = existing.StartedAt
			existingCount = existing.EventCount
		}

		sess := &storage.AISession{
			ID:           last.SessionID,
			Tool:         last.Tool,
			ProjectDir:   last.ProjectDir,
			FilePath:     last.FilePath,
			StartedAt:    startedAt,
			LastEventAt:  last.Timestamp.Unix(),
			EventCount:   existingCount + len(g),
			SourceOffset: last.Offset,
		}
		if err := t.store.UpsertAISession(sess); err != nil {
			return err
		}

		dbEvents := make([]storage.AIEvent, 0, len(g))
		for _, e := range g {
			dbEvents = append(dbEvents, storage.AIEvent{
				SessionID:  e.SessionID,
				Tool:       e.Tool,
				Kind:       e.Kind,
				Timestamp:  e.Timestamp.Unix(),
				ProjectDir: e.ProjectDir,
				Content:    e.Content,
			})
		}
		if err := t.store.InsertAIEvents(dbEvents); err != nil {
			return err
		}
	}
	return nil
}
