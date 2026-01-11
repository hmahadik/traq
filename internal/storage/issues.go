package storage

import (
	"database/sql"
	"fmt"
)

// SaveIssueReport saves an issue report to the database.
func (s *Store) SaveIssueReport(report *IssueReport) (int64, error) {
	screenshotIDsJSON := ToJSONString(report.ScreenshotIDs)

	result, err := s.db.Exec(`
		INSERT INTO issue_reports (
			report_type, error_message, stack_trace, screenshot_ids,
			session_id, user_description, app_version, page_route, webhook_sent
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		report.ReportType, report.ErrorMessage, report.StackTrace, screenshotIDsJSON,
		report.SessionID, report.UserDescription, report.AppVersion, report.PageRoute, report.WebhookSent,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert issue report: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetIssueReport retrieves an issue report by ID.
func (s *Store) GetIssueReport(id int64) (*IssueReport, error) {
	report := &IssueReport{}
	var screenshotIDsJSON sql.NullString

	err := s.db.QueryRow(`
		SELECT id, report_type, error_message, stack_trace, screenshot_ids,
		       session_id, user_description, app_version, page_route, webhook_sent, created_at
		FROM issue_reports WHERE id = ?`, id).Scan(
		&report.ID, &report.ReportType, &report.ErrorMessage, &report.StackTrace, &screenshotIDsJSON,
		&report.SessionID, &report.UserDescription, &report.AppVersion, &report.PageRoute, &report.WebhookSent, &report.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get issue report: %w", err)
	}

	report.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)

	return report, nil
}

// GetIssueReports retrieves the most recent issue reports.
func (s *Store) GetIssueReports(limit int) ([]*IssueReport, error) {
	rows, err := s.db.Query(`
		SELECT id, report_type, error_message, stack_trace, screenshot_ids,
		       session_id, user_description, app_version, page_route, webhook_sent, created_at
		FROM issue_reports
		ORDER BY created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query issue reports: %w", err)
	}
	defer rows.Close()

	var reports []*IssueReport
	for rows.Next() {
		report := &IssueReport{}
		var screenshotIDsJSON sql.NullString
		err := rows.Scan(
			&report.ID, &report.ReportType, &report.ErrorMessage, &report.StackTrace, &screenshotIDsJSON,
			&report.SessionID, &report.UserDescription, &report.AppVersion, &report.PageRoute, &report.WebhookSent, &report.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan issue report: %w", err)
		}
		report.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)
		reports = append(reports, report)
	}

	return reports, rows.Err()
}

// DeleteIssueReport deletes an issue report by ID.
func (s *Store) DeleteIssueReport(id int64) error {
	_, err := s.db.Exec("DELETE FROM issue_reports WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete issue report: %w", err)
	}
	return nil
}

// GetScreenshotIDsSince returns screenshot IDs captured since the given unix timestamp.
func (s *Store) GetScreenshotIDsSince(sinceUnix int64) ([]int64, error) {
	rows, err := s.db.Query(`
		SELECT id FROM screenshots
		WHERE timestamp >= ?
		ORDER BY timestamp DESC`, sinceUnix)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent screenshots: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan screenshot ID: %w", err)
		}
		ids = append(ids, id)
	}

	return ids, rows.Err()
}

// MarkIssueReportWebhookSent marks an issue report as having had its webhook sent.
func (s *Store) MarkIssueReportWebhookSent(id int64) error {
	_, err := s.db.Exec("UPDATE issue_reports SET webhook_sent = 1 WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to mark webhook sent: %w", err)
	}
	return nil
}
