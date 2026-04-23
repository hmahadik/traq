package service

import (
	"os"
	"path/filepath"
	"time"

	"traq/internal/storage"
)

// DefaultAIIdleGapSeconds is the threshold between events before a block splits.
const DefaultAIIdleGapSeconds = 30 * 60

// blockTailPadSeconds pads the end of every block so single-event blocks
// have a visible footprint in the timeline.
const blockTailPadSeconds = 30

// osStat is indirected so tests can substitute it.
var osStat = os.Stat

type AIBlockDisplay struct {
	Tool        string `json:"tool"`
	SessionID   string `json:"sessionId"`
	ProjectDir  string `json:"projectDir"`
	ProjectName string `json:"projectName"`
	StartTime   int64  `json:"startTime"`
	EndTime     int64  `json:"endTime"`
	EventCount  int    `json:"eventCount"`
	IsLive      bool   `json:"isLive"`
}

type AISessionDisplay struct {
	ID          string `json:"id"`
	Tool        string `json:"tool"`
	ProjectName string `json:"projectName"`
	ProjectDir  string `json:"projectDir"`
	StartedAt   int64  `json:"startedAt"`
	LastEventAt int64  `json:"lastEventAt"`
	EventCount  int    `json:"eventCount"`
}

type AISessionDetail struct {
	AISessionDisplay
	FilePath string `json:"filePath"`
}

type AIService struct {
	store          *storage.Store
	idleGapSeconds int
}

func NewAIService(store *storage.Store) *AIService {
	return &AIService{store: store, idleGapSeconds: DefaultAIIdleGapSeconds}
}

func (s *AIService) SetIdleGapSeconds(n int) {
	if n > 0 {
		s.idleGapSeconds = n
	}
}

func (s *AIService) ListAISessions(date string) ([]AISessionDisplay, error) {
	start, end, err := aiDayRangeUnix(date)
	if err != nil {
		return nil, err
	}
	rows, err := s.store.ListAISessionsForDate(start, end)
	if err != nil {
		return nil, err
	}
	out := make([]AISessionDisplay, 0, len(rows))
	for _, r := range rows {
		out = append(out, AISessionDisplay{
			ID:          r.ID,
			Tool:        r.Tool,
			ProjectName: filepath.Base(r.ProjectDir),
			ProjectDir:  r.ProjectDir,
			StartedAt:   r.StartedAt,
			LastEventAt: r.LastEventAt,
			EventCount:  r.EventCount,
		})
	}
	return out, nil
}

func (s *AIService) GetAISession(id string) (*AISessionDetail, error) {
	sess, err := s.store.GetAISessionByID(id)
	if err != nil || sess == nil {
		return nil, err
	}
	return &AISessionDetail{
		AISessionDisplay: AISessionDisplay{
			ID:          sess.ID,
			Tool:        sess.Tool,
			ProjectName: filepath.Base(sess.ProjectDir),
			ProjectDir:  sess.ProjectDir,
			StartedAt:   sess.StartedAt,
			LastEventAt: sess.LastEventAt,
			EventCount:  sess.EventCount,
		},
		FilePath: sess.FilePath,
	}, nil
}

// GetAIActivityForDay returns derived activity blocks grouped by local hour.
func (s *AIService) GetAIActivityForDay(date string) (map[int][]AIBlockDisplay, error) {
	start, end, err := aiDayRangeUnix(date)
	if err != nil {
		return nil, err
	}
	blocks, err := s.deriveBlocks(start, end)
	if err != nil {
		return nil, err
	}
	out := map[int][]AIBlockDisplay{}
	for _, b := range blocks {
		hr := time.Unix(b.StartTime, 0).In(time.Local).Hour()
		out[hr] = append(out[hr], b)
	}
	return out, nil
}

// deriveBlocks groups events into per-session blocks, splitting on idle gaps
// larger than idleGapSeconds. Events from GetAIEventsInRange arrive ordered
// by (tool, session_id, timestamp) so we can walk them in one pass.
func (s *AIService) deriveBlocks(startUnix, endUnix int64) ([]AIBlockDisplay, error) {
	events, err := s.store.GetAIEventsInRange(startUnix, endUnix)
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, nil
	}

	sessionRows := map[string]storage.AISession{}
	blocks := []AIBlockDisplay{}

	var current *AIBlockDisplay
	var prevSessionKey string
	var prevTs int64

	flush := func() {
		if current == nil {
			return
		}
		current.EndTime += blockTailPadSeconds
		blocks = append(blocks, *current)
		current = nil
	}

	for _, e := range events {
		key := e.Tool + "|" + e.SessionID
		gap := e.Timestamp - prevTs
		if current == nil || key != prevSessionKey || gap > int64(s.idleGapSeconds) {
			flush()

			row, ok := sessionRows[e.SessionID]
			if !ok {
				rp, _ := s.store.GetAISessionByID(e.SessionID)
				if rp != nil {
					row = *rp
					sessionRows[e.SessionID] = row
				}
			}

			projectDir := e.ProjectDir
			if projectDir == "" {
				projectDir = row.ProjectDir
			}

			current = &AIBlockDisplay{
				Tool:        e.Tool,
				SessionID:   e.SessionID,
				ProjectDir:  projectDir,
				ProjectName: filepath.Base(projectDir),
				StartTime:   e.Timestamp,
				EndTime:     e.Timestamp,
				EventCount:  0,
				IsLive:      false,
			}
		}
		current.EndTime = e.Timestamp
		current.EventCount++
		prevSessionKey = key
		prevTs = e.Timestamp
	}
	flush()

	s.applyLiveFileRescue(blocks, sessionRows)

	return blocks, nil
}

func (s *AIService) applyLiveFileRescue(blocks []AIBlockDisplay, sessionRows map[string]storage.AISession) {
	threshold := time.Duration(s.idleGapSeconds/3) * time.Second
	now := time.Now()
	for i, b := range blocks {
		if b.Tool != "claude" {
			continue
		}
		row, ok := sessionRows[b.SessionID]
		if !ok || row.FilePath == "" {
			continue
		}
		info, err := osStat(row.FilePath)
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) < threshold {
			blocks[i].IsLive = true
		}
	}
}

// aiDayRangeUnix parses a YYYY-MM-DD date (local time) and returns [start, end]
// as unix seconds covering the calendar day.
func aiDayRangeUnix(date string) (int64, int64, error) {
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return 0, 0, err
	}
	start := t.Unix()
	end := t.Add(24*time.Hour - time.Second).Unix()
	return start, end, nil
}
