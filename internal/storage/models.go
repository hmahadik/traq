package storage

import (
	"database/sql"
	"encoding/json"
)

// Screenshot represents a captured screenshot.
type Screenshot struct {
	ID                int64           `json:"id"`
	Timestamp         int64           `json:"timestamp"`
	Filepath          string          `json:"filepath"`
	DHash             string          `json:"dhash"`
	WindowTitle       sql.NullString  `json:"windowTitle"`
	AppName           sql.NullString  `json:"appName"`
	WindowClass       sql.NullString  `json:"windowClass"`
	ProcessPID        sql.NullInt64   `json:"processPid"`
	WindowX           sql.NullInt64   `json:"windowX"`
	WindowY           sql.NullInt64   `json:"windowY"`
	WindowWidth       sql.NullInt64   `json:"windowWidth"`
	WindowHeight      sql.NullInt64   `json:"windowHeight"`
	MonitorName       sql.NullString  `json:"monitorName"`
	MonitorWidth      sql.NullInt64   `json:"monitorWidth"`
	MonitorHeight     sql.NullInt64   `json:"monitorHeight"`
	SessionID         sql.NullInt64   `json:"sessionId"`
	ProjectID         sql.NullInt64   `json:"projectId"`
	ProjectConfidence sql.NullFloat64 `json:"projectConfidence"`
	ProjectSource     sql.NullString  `json:"projectSource"` // 'unassigned', 'user', 'rule', 'ai'
	CreatedAt         int64           `json:"createdAt"`
}

// Session represents a work session.
type Session struct {
	ID              int64         `json:"id"`
	StartTime       int64         `json:"startTime"`
	EndTime         sql.NullInt64 `json:"endTime"`
	DurationSeconds sql.NullInt64 `json:"durationSeconds"`
	ScreenshotCount int           `json:"screenshotCount"`
	SummaryID       sql.NullInt64 `json:"summaryId"`
	ProjectID       sql.NullInt64 `json:"projectId"`
	CreatedAt       int64         `json:"createdAt"`
}

// Summary represents an AI-generated summary.
type Summary struct {
	ID              int64                   `json:"id"`
	SessionID       sql.NullInt64           `json:"sessionId"`
	Summary         string                  `json:"summary"`
	Explanation     sql.NullString          `json:"explanation"`
	Confidence      sql.NullString          `json:"confidence"`
	Tags            []string                `json:"tags"`
	Projects        []ProjectBreakdown      `json:"projects"`
	ModelUsed       string                  `json:"modelUsed"`
	InferenceTimeMs sql.NullInt64           `json:"inferenceTimeMs"`
	ScreenshotIDs   []int64                 `json:"screenshotIds"`
	ContextJSON     sql.NullString          `json:"contextJson"`
	CreatedAt       int64                   `json:"createdAt"`
}

// ProjectBreakdown represents time spent on a project within a session.
type ProjectBreakdown struct {
	Name        string   `json:"name"`
	TimeMinutes int      `json:"timeMinutes"`
	Activities  []string `json:"activities"`
	Confidence  string   `json:"confidence"`
}

// WindowFocusEvent represents a window focus change.
type WindowFocusEvent struct {
	ID                int64           `json:"id"`
	WindowTitle       string          `json:"windowTitle"`
	AppName           string          `json:"appName"`
	WindowClass       sql.NullString  `json:"windowClass"`
	StartTime         int64           `json:"startTime"`
	EndTime           int64           `json:"endTime"`
	DurationSeconds   float64         `json:"durationSeconds"`
	SessionID         sql.NullInt64   `json:"sessionId"`
	ProjectID         sql.NullInt64   `json:"projectId"`
	ProjectConfidence sql.NullFloat64 `json:"projectConfidence"`
	ProjectSource     sql.NullString  `json:"projectSource"` // 'unassigned', 'user', 'rule', 'ai'
	MemoryStatus      string          `json:"memoryStatus"`  // 'active' or 'ignored'
	CreatedAt         int64           `json:"createdAt"`
}

// ShellCommand represents a shell command from history.
type ShellCommand struct {
	ID               int64           `json:"id"`
	Timestamp        int64           `json:"timestamp"`
	Command          string          `json:"command"`
	ShellType        string          `json:"shellType"`
	WorkingDirectory sql.NullString  `json:"workingDirectory"`
	ExitCode         sql.NullInt64   `json:"exitCode"`
	DurationSeconds  sql.NullFloat64 `json:"durationSeconds"`
	Hostname         sql.NullString  `json:"hostname"`
	SessionID        sql.NullInt64   `json:"sessionId"`
	CreatedAt        int64           `json:"createdAt"`
}

// GitRepository represents a tracked git repository.
type GitRepository struct {
	ID          int64          `json:"id"`
	Path        string         `json:"path"`
	Name        string         `json:"name"`
	RemoteURL   sql.NullString `json:"remoteUrl"`
	LastScanned sql.NullInt64  `json:"lastScanned"`
	IsActive    bool           `json:"isActive"`
	CreatedAt   int64          `json:"createdAt"`
}

// GitCommit represents a git commit.
type GitCommit struct {
	ID                int64           `json:"id"`
	Timestamp         int64           `json:"timestamp"`
	CommitHash        string          `json:"commitHash"`
	ShortHash         string          `json:"shortHash"`
	RepositoryID      int64           `json:"repositoryId"`
	Branch            sql.NullString  `json:"branch"`
	Message           string          `json:"message"`
	MessageSubject    string          `json:"messageSubject"`
	FilesChanged      sql.NullInt64   `json:"filesChanged"`
	Insertions        sql.NullInt64   `json:"insertions"`
	Deletions         sql.NullInt64   `json:"deletions"`
	AuthorName        sql.NullString  `json:"authorName"`
	AuthorEmail       sql.NullString  `json:"authorEmail"`
	IsMerge           bool            `json:"isMerge"`
	SessionID         sql.NullInt64   `json:"sessionId"`
	ProjectID         sql.NullInt64   `json:"projectId"`
	ProjectConfidence sql.NullFloat64 `json:"projectConfidence"`
	ProjectSource     sql.NullString  `json:"projectSource"` // 'unassigned', 'user', 'rule', 'ai'
	CreatedAt         int64           `json:"createdAt"`
}

// FileEvent represents a file system event.
type FileEvent struct {
	ID            int64          `json:"id"`
	Timestamp     int64          `json:"timestamp"`
	EventType     string         `json:"eventType"` // created, modified, deleted, renamed
	FilePath      string         `json:"filePath"`
	FileName      string         `json:"fileName"`
	Directory     string         `json:"directory"`
	FileExtension sql.NullString `json:"fileExtension"`
	FileSizeBytes sql.NullInt64  `json:"fileSizeBytes"`
	WatchCategory string         `json:"watchCategory"` // downloads, projects, documents
	OldPath       sql.NullString `json:"oldPath"`       // For renamed events
	SessionID     sql.NullInt64  `json:"sessionId"`
	CreatedAt     int64          `json:"createdAt"`
}

// BrowserVisit represents a browser history entry.
type BrowserVisit struct {
	ID                   int64          `json:"id"`
	Timestamp            int64          `json:"timestamp"`
	URL                  string         `json:"url"`
	Title                sql.NullString `json:"title"`
	Domain               string         `json:"domain"`
	Browser              string         `json:"browser"` // chrome, firefox, safari, edge
	VisitDurationSeconds sql.NullInt64  `json:"visitDurationSeconds"`
	TransitionType       sql.NullString `json:"transitionType"`
	SessionID            sql.NullInt64  `json:"sessionId"`
	CreatedAt            int64          `json:"createdAt"`
}

// Report represents a generated report.
type Report struct {
	ID         int64          `json:"id"`
	Title      string         `json:"title"`
	TimeRange  string         `json:"timeRange"`
	ReportType string         `json:"reportType"` // summary, detailed, standup
	Format     string         `json:"format"`     // markdown, html, pdf, json
	Content    sql.NullString `json:"content"`
	Filepath   sql.NullString `json:"filepath"`
	StartTime  sql.NullInt64  `json:"startTime"`
	EndTime    sql.NullInt64  `json:"endTime"`
	CreatedAt  int64          `json:"createdAt"`
}

// AFKEvent represents an away-from-keyboard period.
type AFKEvent struct {
	ID          int64         `json:"id"`
	StartTime   int64         `json:"startTime"`
	EndTime     sql.NullInt64 `json:"endTime"`     // NULL while AFK is ongoing
	SessionID   sql.NullInt64 `json:"sessionId"`
	TriggerType string        `json:"triggerType"` // idle_timeout, system_sleep, manual
	CreatedAt   int64         `json:"createdAt"`
}

// HierarchicalSummary represents a day/week/month summary.
type HierarchicalSummary struct {
	ID          int64  `json:"id"`
	PeriodType  string `json:"periodType"` // day, week, month
	PeriodDate  string `json:"periodDate"` // ISO date (YYYY-MM-DD for day, YYYY-WXX for week, YYYY-MM for month)
	Summary     string `json:"summary"`
	UserEdited  bool   `json:"userEdited"`
	GeneratedAt int64  `json:"generatedAt"`
	CreatedAt   int64  `json:"createdAt"`
}

// Project represents a tracked project.
type Project struct {
	ID                int64  `json:"id"`
	Name              string `json:"name"`
	Color             string `json:"color"`
	Description       string `json:"description,omitempty"`
	DetectionPatterns string `json:"detectionPatterns"` // JSON string with detection rules
	IsManual          bool   `json:"isManual"`
	CreatedAt         int64  `json:"createdAt"`
	UpdatedAt         int64  `json:"updatedAt,omitempty"`
}

// ProjectPattern represents a learned pattern for project detection.
type ProjectPattern struct {
	ID           int64   `json:"id"`
	ProjectID    int64   `json:"projectId"`
	PatternType  string  `json:"patternType"`  // 'app_name', 'window_title', 'git_repo', 'domain', 'path'
	PatternValue string  `json:"patternValue"`
	MatchType    string  `json:"matchType"`    // 'exact', 'contains', 'prefix', 'suffix', 'regex'
	Weight       float64 `json:"weight"`
	HitCount     int     `json:"hitCount"`
	LastUsedAt   int64   `json:"lastUsedAt,omitempty"`
	CreatedAt    int64   `json:"createdAt"`
}

// AssignmentExample stores user assignment context for few-shot learning.
type AssignmentExample struct {
	ID          int64  `json:"id"`
	ProjectID   int64  `json:"projectId"`
	EventType   string `json:"eventType"` // 'screenshot', 'focus', 'git'
	EventID     int64  `json:"eventId"`
	ContextJSON string `json:"contextJson"`
	CreatedAt   int64  `json:"createdAt"`
}

// AssignmentContext captures event context for pattern learning and AI suggestions.
type AssignmentContext struct {
	AppName     string `json:"appName,omitempty"`
	WindowTitle string `json:"windowTitle,omitempty"`
	URL         string `json:"url,omitempty"`
	GitRepo     string `json:"gitRepo,omitempty"`
	FilePath    string `json:"filePath,omitempty"`
	BranchName  string `json:"branchName,omitempty"`
	Domain      string `json:"domain,omitempty"`
}

// DetectionRules defines patterns for automatically detecting a project.
type DetectionRules struct {
	GitRepos            []string `json:"gitRepos,omitempty"`
	FilePaths           []string `json:"filePaths,omitempty"`
	WindowTitlePatterns []string `json:"windowTitlePatterns,omitempty"`
	AppNames            []string `json:"appNames,omitempty"`
	Domains             []string `json:"domains,omitempty"`
}

// TagUsageInfo represents tag aggregation info.
type TagUsageInfo struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

// IssueReport represents a crash or manual issue report.
type IssueReport struct {
	ID              int64          `json:"id"`
	ReportType      string         `json:"reportType"` // "crash" or "manual"
	ErrorMessage    sql.NullString `json:"errorMessage"`
	StackTrace      sql.NullString `json:"stackTrace"`
	ScreenshotIDs   []int64        `json:"screenshotIds"`
	SessionID       sql.NullInt64  `json:"sessionId"`
	UserDescription sql.NullString `json:"userDescription"`
	AppVersion      sql.NullString `json:"appVersion"`
	PageRoute       sql.NullString `json:"pageRoute"`
	WebhookSent     bool           `json:"webhookSent"`
	CreatedAt       int64          `json:"createdAt"`
}

// Helper functions for JSON array fields

// ParseJSONStringArray parses a JSON string array from a nullable string.
func ParseJSONStringArray(s sql.NullString) []string {
	if !s.Valid || s.String == "" {
		return nil
	}
	var result []string
	if err := json.Unmarshal([]byte(s.String), &result); err != nil {
		return nil
	}
	return result
}

// ParseJSONInt64Array parses a JSON int64 array from a nullable string.
func ParseJSONInt64Array(s sql.NullString) []int64 {
	if !s.Valid || s.String == "" {
		return nil
	}
	var result []int64
	if err := json.Unmarshal([]byte(s.String), &result); err != nil {
		return nil
	}
	return result
}

// ToJSONString converts a slice to a JSON string.
func ToJSONString(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// NullString creates a sql.NullString from a string.
func NullString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

// NullInt64 creates a sql.NullInt64 from an int64.
func NullInt64(i int64) sql.NullInt64 {
	return sql.NullInt64{Int64: i, Valid: true}
}
