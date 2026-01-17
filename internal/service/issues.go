package service

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"traq/internal/storage"
)

// IssueService handles issue reporting (crash and manual reports)
type IssueService struct {
	store   *storage.Store
	version string
}

// NewIssueService creates a new IssueService
func NewIssueService(store *storage.Store, version string) *IssueService {
	return &IssueService{
		store:   store,
		version: version,
	}
}

// CreateIssueRequest represents a request to create an issue report
type CreateIssueRequest struct {
	ReportType      string `json:"reportType"`      // "crash" or "manual"
	ErrorMessage    string `json:"errorMessage"`
	StackTrace      string `json:"stackTrace"`
	UserDescription string `json:"userDescription"`
	PageRoute       string `json:"pageRoute"`
}

// IssueReport is the response type (mirrors storage.IssueReport with simplified types)
type IssueReport struct {
	ID              int64   `json:"id"`
	ReportType      string  `json:"reportType"`
	ErrorMessage    string  `json:"errorMessage"`
	StackTrace      string  `json:"stackTrace"`
	ScreenshotIDs   []int64 `json:"screenshotIds"`
	SessionID       int64   `json:"sessionId"`
	UserDescription string  `json:"userDescription"`
	AppVersion      string  `json:"appVersion"`
	PageRoute       string  `json:"pageRoute"`
	WebhookSent     bool    `json:"webhookSent"`
	CreatedAt       int64   `json:"createdAt"`
}

// CreateIssueReport creates a new issue report with auto-attached context
func (s *IssueService) CreateIssueReport(req CreateIssueRequest) (*IssueReport, error) {
	// Get screenshots from the last 60 seconds
	sinceTime := time.Now().Unix() - 60
	screenshotIDs, err := s.store.GetScreenshotIDsSince(sinceTime)
	if err != nil {
		log.Printf("Warning: failed to get recent screenshots: %v", err)
		screenshotIDs = []int64{}
	}

	// Get current session ID (if any)
	var sessionID sql.NullInt64
	currentSession, _ := s.store.GetCurrentSession()
	if currentSession != nil {
		sessionID = sql.NullInt64{Int64: currentSession.ID, Valid: true}
	}

	// Create the storage model
	report := &storage.IssueReport{
		ReportType:      req.ReportType,
		ErrorMessage:    sql.NullString{String: req.ErrorMessage, Valid: req.ErrorMessage != ""},
		StackTrace:      sql.NullString{String: req.StackTrace, Valid: req.StackTrace != ""},
		ScreenshotIDs:   screenshotIDs,
		SessionID:       sessionID,
		UserDescription: sql.NullString{String: req.UserDescription, Valid: req.UserDescription != ""},
		AppVersion:      sql.NullString{String: s.version, Valid: s.version != ""},
		PageRoute:       sql.NullString{String: req.PageRoute, Valid: req.PageRoute != ""},
		WebhookSent:     false,
		CreatedAt:       time.Now().Unix(),
	}

	// Save to database
	id, err := s.store.SaveIssueReport(report)
	if err != nil {
		return nil, fmt.Errorf("failed to save issue report: %w", err)
	}
	report.ID = id

	// Send to Sentry (both crash and manual reports)
	go s.sendToSentry(report)

	// Send webhook if enabled and this is a crash report
	if req.ReportType == "crash" {
		go s.sendWebhookIfEnabled(report)
	}

	return s.toServiceReport(report), nil
}

// sendToSentry sends the issue report to Sentry for centralized tracking
func (s *IssueService) sendToSentry(report *storage.IssueReport) {
	// Create Sentry event based on report type
	if report.ReportType == "crash" && report.ErrorMessage.Valid {
		// For crash reports, capture as exception
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("report_type", report.ReportType)
			scope.SetTag("source", "backend_issue_service")
			if report.PageRoute.Valid {
				scope.SetTag("page_route", report.PageRoute.String)
			}
			if report.AppVersion.Valid {
				scope.SetExtra("app_version", report.AppVersion.String)
			}
			if report.UserDescription.Valid {
				scope.SetExtra("user_description", report.UserDescription.String)
			}
			if report.StackTrace.Valid {
				scope.SetExtra("stack_trace", report.StackTrace.String)
			}
			scope.SetExtra("report_id", report.ID)

			sentry.CaptureMessage(fmt.Sprintf("[Crash] %s", report.ErrorMessage.String))
		})
	} else {
		// For manual reports, capture as message
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("report_type", report.ReportType)
			scope.SetTag("source", "backend_issue_service")
			if report.PageRoute.Valid {
				scope.SetTag("page_route", report.PageRoute.String)
			}
			if report.AppVersion.Valid {
				scope.SetExtra("app_version", report.AppVersion.String)
			}
			scope.SetExtra("report_id", report.ID)

			message := "Manual issue report"
			if report.UserDescription.Valid && report.UserDescription.String != "" {
				message = report.UserDescription.String
			} else if report.ErrorMessage.Valid && report.ErrorMessage.String != "" {
				message = report.ErrorMessage.String
			}

			sentry.CaptureMessage(fmt.Sprintf("[Manual] %s", message))
		})
	}
}

// GetIssueReports returns recent issue reports
func (s *IssueService) GetIssueReports(limit int) ([]*IssueReport, error) {
	reports, err := s.store.GetIssueReports(limit)
	if err != nil {
		return nil, err
	}

	result := make([]*IssueReport, len(reports))
	for i, r := range reports {
		result[i] = s.toServiceReport(r)
	}
	return result, nil
}

// GetIssueReport returns a single issue report
func (s *IssueService) GetIssueReport(id int64) (*IssueReport, error) {
	report, err := s.store.GetIssueReport(id)
	if err != nil {
		return nil, err
	}
	if report == nil {
		return nil, nil
	}
	return s.toServiceReport(report), nil
}

// DeleteIssueReport deletes an issue report
func (s *IssueService) DeleteIssueReport(id int64) error {
	return s.store.DeleteIssueReport(id)
}

// TestWebhook sends a test notification to the configured webhook
func (s *IssueService) TestWebhook() error {
	webhookURL, err := s.store.GetConfig("issues.webhookUrl")
	if err != nil || webhookURL == "" {
		return fmt.Errorf("webhook URL not configured")
	}

	enabled, _ := s.store.GetConfig("issues.webhookEnabled")
	if enabled != "true" {
		return fmt.Errorf("webhook is not enabled")
	}

	payload := map[string]interface{}{
		"text": "Test notification from Traq - webhook is working!",
	}

	return s.sendWebhookPayload(webhookURL, payload)
}

// sendWebhookIfEnabled sends a webhook notification if configured
func (s *IssueService) sendWebhookIfEnabled(report *storage.IssueReport) {
	webhookURL, err := s.store.GetConfig("issues.webhookUrl")
	if err != nil || webhookURL == "" {
		return
	}

	enabled, _ := s.store.GetConfig("issues.webhookEnabled")
	if enabled != "true" {
		return
	}

	// Format message for Slack/Discord/Teams compatibility
	errorMsg := report.ErrorMessage.String
	if errorMsg == "" {
		errorMsg = "No error message"
	}
	route := report.PageRoute.String
	if route == "" {
		route = "Unknown"
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf("*Traq Crash Report*\n\n*Error:* %s\n*Page:* %s\n*Version:* %s",
			errorMsg, route, report.AppVersion.String),
	}

	if err := s.sendWebhookPayload(webhookURL, payload); err != nil {
		log.Printf("Failed to send webhook: %v", err)
		return
	}

	// Mark as sent
	if err := s.store.MarkIssueReportWebhookSent(report.ID); err != nil {
		log.Printf("Failed to mark webhook sent: %v", err)
	}
}

// sendWebhookPayload sends a JSON payload to the webhook URL
func (s *IssueService) sendWebhookPayload(url string, payload map[string]interface{}) error {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// toServiceReport converts a storage model to a service model
func (s *IssueService) toServiceReport(r *storage.IssueReport) *IssueReport {
	return &IssueReport{
		ID:              r.ID,
		ReportType:      r.ReportType,
		ErrorMessage:    r.ErrorMessage.String,
		StackTrace:      r.StackTrace.String,
		ScreenshotIDs:   r.ScreenshotIDs,
		SessionID:       r.SessionID.Int64,
		UserDescription: r.UserDescription.String,
		AppVersion:      r.AppVersion.String,
		PageRoute:       r.PageRoute.String,
		WebhookSent:     r.WebhookSent,
		CreatedAt:       r.CreatedAt,
	}
}
