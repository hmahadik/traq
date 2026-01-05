package storage

import (
	"database/sql"
	"fmt"
)

// SaveReport saves a report to the database.
func (s *Store) SaveReport(report *Report) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO reports (
			title, time_range, report_type, format, content, filepath, start_time, end_time
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		report.Title, report.TimeRange, report.ReportType, report.Format,
		report.Content, report.Filepath, report.StartTime, report.EndTime,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert report: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetReport retrieves a report by ID.
func (s *Store) GetReport(id int64) (*Report, error) {
	report := &Report{}
	err := s.db.QueryRow(`
		SELECT id, title, time_range, report_type, format, content, filepath, start_time, end_time, created_at
		FROM reports WHERE id = ?`, id).Scan(
		&report.ID, &report.Title, &report.TimeRange, &report.ReportType, &report.Format,
		&report.Content, &report.Filepath, &report.StartTime, &report.EndTime, &report.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get report: %w", err)
	}
	return report, nil
}

// GetAllReports retrieves all reports, most recent first.
func (s *Store) GetAllReports() ([]*Report, error) {
	rows, err := s.db.Query(`
		SELECT id, title, time_range, report_type, format, content, filepath, start_time, end_time, created_at
		FROM reports
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query reports: %w", err)
	}
	defer rows.Close()

	var reports []*Report
	for rows.Next() {
		report := &Report{}
		err := rows.Scan(
			&report.ID, &report.Title, &report.TimeRange, &report.ReportType, &report.Format,
			&report.Content, &report.Filepath, &report.StartTime, &report.EndTime, &report.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan report: %w", err)
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

// GetRecentReports retrieves the most recent N reports.
func (s *Store) GetRecentReports(limit int) ([]*Report, error) {
	rows, err := s.db.Query(`
		SELECT id, title, time_range, report_type, format, content, filepath, start_time, end_time, created_at
		FROM reports
		ORDER BY created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent reports: %w", err)
	}
	defer rows.Close()

	var reports []*Report
	for rows.Next() {
		report := &Report{}
		err := rows.Scan(
			&report.ID, &report.Title, &report.TimeRange, &report.ReportType, &report.Format,
			&report.Content, &report.Filepath, &report.StartTime, &report.EndTime, &report.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan report: %w", err)
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

// DeleteReport deletes a report by ID.
func (s *Store) DeleteReport(id int64) error {
	_, err := s.db.Exec("DELETE FROM reports WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete report: %w", err)
	}
	return nil
}

// CountReports returns the total number of reports.
func (s *Store) CountReports() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM reports").Scan(&count)
	return count, err
}
