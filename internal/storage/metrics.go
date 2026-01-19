package storage

// AssignmentMetrics holds accuracy statistics for project assignments
type AssignmentMetrics struct {
	PeriodStart     int64   `json:"periodStart"`
	PeriodEnd       int64   `json:"periodEnd"`
	TotalActivities int     `json:"totalActivities"`
	AutoAssigned    int     `json:"autoAssigned"`
	UserAssigned    int     `json:"userAssigned"`
	Corrections     int     `json:"corrections"`
	AccuracyRate    float64 `json:"accuracyRate"`
}

// GetAssignmentMetrics calculates assignment accuracy for a time period
func (s *Store) GetAssignmentMetrics(startTime, endTime int64) (*AssignmentMetrics, error) {
	metrics := &AssignmentMetrics{
		PeriodStart: startTime,
		PeriodEnd:   endTime,
	}

	// Count total activities with assignments
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM window_focus_events
		WHERE start_time >= ? AND start_time <= ?
		  AND project_id IS NOT NULL
	`, startTime, endTime).Scan(&metrics.TotalActivities)
	if err != nil {
		return nil, err
	}

	// Count by source
	rows, err := s.db.Query(`
		SELECT project_source, COUNT(*) FROM window_focus_events
		WHERE start_time >= ? AND start_time <= ?
		  AND project_id IS NOT NULL
		GROUP BY project_source
	`, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var source string
		var count int
		if err := rows.Scan(&source, &count); err != nil {
			return nil, err
		}
		switch source {
		case "user":
			metrics.UserAssigned = count
		case "rule", "embedding":
			metrics.AutoAssigned += count
		}
	}

	// Calculate accuracy rate
	// For now, accuracy is 100% minus corrections ratio
	// TODO: Track corrections separately (requires storing original assignment)
	if metrics.AutoAssigned > 0 {
		metrics.AccuracyRate = float64(metrics.AutoAssigned-metrics.Corrections) / float64(metrics.AutoAssigned)
	} else {
		metrics.AccuracyRate = 1.0 // No auto-assignments means no errors
	}

	return metrics, nil
}
