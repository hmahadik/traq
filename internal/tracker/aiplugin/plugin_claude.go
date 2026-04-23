package aiplugin

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"time"

	"traq/internal/storage"
)

const toolClaude = "claude"

// ClaudePlugin tails Claude Code JSONL session files in <root>/<project-slug>/*.jsonl.
type ClaudePlugin struct {
	root string // ~/.claude/projects (or a fixture root in tests)
}

func NewClaudePlugin(root string) *ClaudePlugin {
	return &ClaudePlugin{root: root}
}

func (p *ClaudePlugin) Name() string { return toolClaude }

func (p *ClaudePlugin) Available() bool {
	info, err := os.Stat(p.root)
	return err == nil && info.IsDir()
}

// claudeLine matches the fields the plugin cares about. Bodies and snapshot
// contents are ignored by design — only metadata is stored downstream.
type claudeLine struct {
	Type      string    `json:"type"`
	SessionID string    `json:"sessionId"`
	CWD       string    `json:"cwd"`
	Timestamp time.Time `json:"timestamp"`
	Message   struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

func (p *ClaudePlugin) Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error) {
	var out []AIEvent

	matches, err := filepath.Glob(filepath.Join(p.root, "*", "*.jsonl"))
	if err != nil {
		return nil, err
	}
	for _, path := range matches {
		if ctx.Err() != nil {
			return out, ctx.Err()
		}
		events, err := p.readFile(path, store)
		if err != nil {
			// Don't fail the whole poll for one bad file.
			continue
		}
		out = append(out, events...)
	}
	return out, nil
}

func (p *ClaudePlugin) readFile(path string, store *storage.Store) ([]AIEvent, error) {
	sess, err := store.GetAISessionByFilePath(path)
	if err != nil {
		return nil, err
	}
	var startOffset int64
	if sess != nil {
		startOffset = sess.SourceOffset
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if _, err := f.Seek(startOffset, io.SeekStart); err != nil {
		return nil, err
	}

	var events []AIEvent
	pos := startOffset
	reader := bufio.NewReader(f)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			pos += int64(len(line))
			if ev, ok := parseClaudeLine(line, path, pos); ok {
				events = append(events, ev)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return events, err
		}
	}
	return events, nil
}

func parseClaudeLine(line []byte, filePath string, offsetAfter int64) (AIEvent, bool) {
	var cl claudeLine
	if err := json.Unmarshal(line, &cl); err != nil {
		return AIEvent{}, false
	}
	kind := claudeKind(&cl)
	if kind == "" {
		return AIEvent{}, false
	}
	if cl.SessionID == "" || cl.Timestamp.IsZero() {
		return AIEvent{}, false
	}
	return AIEvent{
		Tool:       toolClaude,
		SessionID:  cl.SessionID,
		ProjectDir: cl.CWD,
		Timestamp:  cl.Timestamp,
		Kind:       kind,
		FilePath:   filePath,
		Offset:     offsetAfter,
	}, true
}

func claudeKind(cl *claudeLine) string {
	switch cl.Type {
	case "user":
		return "user_prompt"
	case "assistant":
		if containsToolUse(cl.Message.Content) {
			return "tool_use"
		}
		return "assistant_turn"
	default:
		return ""
	}
}

func containsToolUse(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var items []struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &items); err != nil {
		return false
	}
	for _, it := range items {
		if it.Type == "tool_use" {
			return true
		}
	}
	return false
}
