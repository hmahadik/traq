// Shared types for the reports service, extracted from reports.go for navigability.

package service

import (
	"traq/internal/storage"
)

// TimeRange represents a parsed time range.
type TimeRange struct {
	Start     int64  `json:"start"`
	End       int64  `json:"end"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Label     string `json:"label"`
}

// ReportMeta contains metadata about a generated report.
type ReportMeta struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	TimeRange  string `json:"timeRange"`
	ReportType string `json:"reportType"`
	Format     string `json:"format"`
	CreatedAt  int64  `json:"createdAt"`
}

// Report is the service-layer report type with plain strings (not sql.Null types).
type Report struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	TimeRange  string `json:"timeRange"`
	ReportType string `json:"reportType"`
	Format     string `json:"format"`
	Content    string `json:"content"`
	Filepath   string `json:"filepath"`
	StartTime  int64  `json:"startTime"`
	EndTime    int64  `json:"endTime"`
	CreatedAt  int64  `json:"createdAt"`
}

// WindowBreakdown shows time spent per window within an app
type WindowBreakdown struct {
	WindowTitle     string  `json:"windowTitle"`
	DurationSeconds float64 `json:"durationSeconds"`
	Percentage      float64 `json:"percentage"`
	IsMeeting       bool    `json:"isMeeting"`
	MeetingPlatform string  `json:"meetingPlatform,omitempty"`
	ProjectPath     string  `json:"projectPath,omitempty"`
}

// AppDetailedUsage extends AppUsage with window breakdown
type AppDetailedUsage struct {
	AppName         string            `json:"appName"`
	FriendlyName    string            `json:"friendlyName"`
	DurationSeconds float64           `json:"durationSeconds"`
	Percentage      float64           `json:"percentage"`
	Category        string            `json:"category"`
	Windows         []WindowBreakdown `json:"windows"`
	MeetingCount    int               `json:"meetingCount"`
}

// DomainGroup represents browser activity grouped by domain
type DomainGroup struct {
	Domain          string   `json:"domain"`
	DurationSeconds float64  `json:"durationSeconds"`
	VisitCount      int64    `json:"visitCount"`
	TopicLabel      string   `json:"topicLabel"`
	SampleTitles    []string `json:"sampleTitles"`
}

// MeetingDetection represents a detected meeting from window titles
type MeetingDetection struct {
	Platform        string  `json:"platform"`
	Title           string  `json:"title"`
	WindowTitle     string  `json:"windowTitle"`
	StartTime       int64   `json:"startTime"`
	DurationSeconds float64 `json:"durationSeconds"`
}

// EnhancedReportContext holds all aggregated data for report generation
type EnhancedReportContext struct {
	TimeRange          *TimeRange
	Sessions           []*storage.Session
	SummariesMap       map[int64]*storage.Summary
	AppUsage           []*AppDetailedUsage
	DomainGroups       []DomainGroup
	Meetings           []MeetingDetection
	GitCommits         []*storage.GitCommit
	ShellCommands      []*storage.ShellCommand
	FileEvents         []*storage.FileEvent
	TotalMinutes       int64
	ProductiveMinutes  int64
	DistractingMinutes int64
	NeutralMinutes     int64
	ProductivityScore  int
	SessionCount       int
}

// ProjectGroup represents activity grouped by project/theme
type ProjectGroup struct {
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	DurationSeconds float64                `json:"durationSeconds"`
	DurationMinutes int64                  `json:"durationMinutes"`
	Percentage      float64                `json:"percentage"`
	CommitCount     int                    `json:"commitCount"`
	Commits         []*storage.GitCommit   `json:"commits"`
	Apps            []string               `json:"apps"`
	Activities      []string               `json:"activities"`
	DailyBreakdown  map[string]*ReportDailyStats `json:"dailyBreakdown"`
}

// ReportDailyStats holds stats for a single day in reports
type ReportDailyStats struct {
	Date            string   `json:"date"`
	DayOfWeek       string   `json:"dayOfWeek"`
	DurationMinutes int64    `json:"durationMinutes"`
	SessionCount    int      `json:"sessionCount"`
	CommitCount     int      `json:"commitCount"`
	Accomplishments []string `json:"accomplishments"`
	PrimaryFocus    string   `json:"primaryFocus"`
}

// CommitsByRepo groups commits by repository
type CommitsByRepo struct {
	RepoName    string               `json:"repoName"`
	RepoPath    string               `json:"repoPath"`
	CommitCount int                  `json:"commitCount"`
	Commits     []*storage.GitCommit `json:"commits"`
}

// HourlyActivityData represents activity for a single hour.
type HourlyActivityData struct {
	Hour    int
	Minutes int64
}

// TimelineEvent represents a unified event for chronological display.
type TimelineEvent struct {
	Timestamp int64
	Type      string // "git", "shell", "file", "browser"
	Summary   string
}

type DailySummary struct {
	ID            int64  `json:"id"`
	Date          string `json:"date"`        // YYYY-MM-DD
	Summary       string `json:"summary"`     // Preview text (first ~200 chars)
	TotalTime     int64  `json:"totalTime"`   // Total active time in seconds
	SessionsCount int    `json:"sessionsCount"`
	CreatedAt     int64  `json:"createdAt"`
}

// WeeklySummaryData holds all the aggregated data for a weekly summary report.
type WeeklySummaryData struct {
	StartDate       string
	EndDate         string
	TotalHours      float64
	SessionCount    int
	ScreenshotCount int
	FocusEventCount int
	GitCommitCount  int
	ShellCmdCount   int
	FileEventCount  int

	// Project distribution
	Projects []ProjectSummary

	// Daily breakdown
	DailyStats []DailySummaryStats

	// Git statistics
	TotalInsertions int64
	TotalDeletions  int64
	CommitsByRepo   []*CommitsByRepo

	// Meetings
	Meetings []MeetingDetection

	// Slack channels
	SlackChannels []SlackChannel

	// Browser activity by domain with page titles
	BrowserDomains []BrowserDomainSummary

	// App usage
	AppUsage []*AppDetailedUsage

	// File downloads
	Downloads []FileSummary

	// Research topics (from Claude/AI assistant pages)
	ResearchTopics []ResearchTopic

	// Key accomplishments (top-level highlights)
	KeyAccomplishments []string

	// Total communication time
	TotalSlackMins int64
	TotalZoomMins  int64
	TotalEmailMins int64
}

// ProjectSummary represents a project with its time and accomplishments
type ProjectSummary struct {
	Name           string
	Description    string
	Hours          float64
	Percentage     float64
	CommitCount    int
	DailyAccomplishments map[string][]string // date -> accomplishments
	Apps           []string
}

// DailySummaryStats holds stats for a single day
type DailySummaryStats struct {
	Date            string
	DayOfWeek       string
	DayName         string // "Mon Jan 06"
	Hours           float64
	SessionCount    int
	CommitCount     int
	PrimaryFocus    string
	Accomplishments []string
}

// SlackChannel holds Slack channel activity
type SlackChannel struct {
	Name         string
	DurationMins int64
	IsHuddle     bool
}

// BrowserDomainSummary holds browser activity for a domain
type BrowserDomainSummary struct {
	Domain        string
	DurationMins  int64
	VisitCount    int64
	Category      string
	SampleTitles  []string
}

// FileSummary represents a downloaded file
type FileSummary struct {
	FileName  string
	Timestamp int64
	Category  string
}

// ResearchTopic represents a research topic from browser activity
type ResearchTopic struct {
	Topic        string
	DurationMins int64
	Source       string
}
