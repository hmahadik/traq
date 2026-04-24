package aiplugin

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"traq/internal/storage"
)

const toolClaude = "claude"

// ClaudePlugin tails Claude Code JSONL session files in <root>/<project-slug>/*.jsonl.
type ClaudePlugin struct {
	root               string // ~/.claude/projects (or a fixture root in tests)
	storePromptContent bool
}

func NewClaudePlugin(root string) *ClaudePlugin {
	return &ClaudePlugin{root: root}
}

// SetStorePromptContent enables/disables storage of verbatim user-prompt
// text on emitted events. Off by default — aligns with the design doc's
// "no transcript storage by default" privacy claim.
func (p *ClaudePlugin) SetStorePromptContent(v bool) {
	p.storePromptContent = v
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
	IsMeta    bool      `json:"isMeta"`
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
			if ev, ok := parseClaudeLine(line, path, pos, p.storePromptContent); ok {
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

func parseClaudeLine(line []byte, filePath string, offsetAfter int64, storePromptContent bool) (AIEvent, bool) {
	var cl claudeLine
	if err := json.Unmarshal(line, &cl); err != nil {
		return AIEvent{}, false
	}
	kind, content := claudeKind(&cl)
	if kind == "" {
		return AIEvent{}, false
	}
	if cl.SessionID == "" || cl.Timestamp.IsZero() {
		return AIEvent{}, false
	}
	// Respect the privacy toggle. The kind="user_prompt" event is still
	// emitted so the timeline can show the marker; only the text body is
	// dropped.
	if !storePromptContent {
		content = ""
	}
	return AIEvent{
		Tool:       toolClaude,
		SessionID:  cl.SessionID,
		ProjectDir: cl.CWD,
		Timestamp:  cl.Timestamp,
		Kind:       kind,
		FilePath:   filePath,
		Offset:     offsetAfter,
		Content:    content,
	}, true
}

// claudeKind classifies a line and, for user prompts, returns the extracted
// text. Meta messages and tool-result user messages are skipped — they
// aren't prompts the user typed.
func claudeKind(cl *claudeLine) (string, string) {
	switch cl.Type {
	case "user":
		if cl.IsMeta {
			return "", ""
		}
		text, ok := extractUserPromptText(cl.Message.Content)
		if !ok {
			return "", ""
		}
		return "user_prompt", text
	case "assistant":
		if containsToolUse(cl.Message.Content) {
			return "tool_use", ""
		}
		return "assistant_turn", ""
	default:
		return "", ""
	}
}

// extractUserPromptText pulls the prompt text out of Claude's user message
// content. Content can be either a bare string or an array of typed blocks.
// Lines whose content is only tool results are rejected (ok=false).
func extractUserPromptText(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}
	// Bare string form.
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s, true
	}
	// Array-of-blocks form.
	var items []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &items); err != nil {
		return "", false
	}
	var parts []string
	sawNonToolResult := false
	for _, it := range items {
		if it.Type != "tool_result" {
			sawNonToolResult = true
		}
		if it.Type == "text" && it.Text != "" {
			parts = append(parts, it.Text)
		}
	}
	if !sawNonToolResult {
		return "", false
	}
	return strings.Join(parts, "\n"), true
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
