package storage

import (
	"database/sql"
	"fmt"
)

// SaveShellCommand saves a shell command to the database.
func (s *Store) SaveShellCommand(cmd *ShellCommand) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO shell_commands (
			timestamp, command, shell_type, working_directory,
			exit_code, duration_seconds, hostname, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		cmd.Timestamp, cmd.Command, cmd.ShellType, cmd.WorkingDirectory,
		cmd.ExitCode, cmd.DurationSeconds, cmd.Hostname, cmd.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert shell command: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetShellCommandsBySession retrieves all shell commands for a session.
func (s *Store) GetShellCommandsBySession(sessionID int64) ([]*ShellCommand, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, command, shell_type, working_directory,
		       exit_code, duration_seconds, hostname, session_id, created_at
		FROM shell_commands
		WHERE session_id = ?
		ORDER BY timestamp ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query shell commands: %w", err)
	}
	defer rows.Close()

	return scanShellCommands(rows)
}

// GetShellCommandsByTimeRange retrieves shell commands within a time range.
func (s *Store) GetShellCommandsByTimeRange(start, end int64) ([]*ShellCommand, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, command, shell_type, working_directory,
		       exit_code, duration_seconds, hostname, session_id, created_at
		FROM shell_commands
		WHERE timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query shell commands by time: %w", err)
	}
	defer rows.Close()

	return scanShellCommands(rows)
}

// GetRecentShellCommands retrieves the most recent N shell commands.
func (s *Store) GetRecentShellCommands(limit int) ([]*ShellCommand, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, command, shell_type, working_directory,
		       exit_code, duration_seconds, hostname, session_id, created_at
		FROM shell_commands
		ORDER BY timestamp DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent shell commands: %w", err)
	}
	defer rows.Close()

	return scanShellCommands(rows)
}

// CommandExists checks if a command with the given timestamp already exists.
func (s *Store) CommandExists(timestamp int64, command string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM shell_commands WHERE timestamp = ? AND command = ?)`,
		timestamp, command).Scan(&exists)
	return exists, err
}

// CountShellCommands returns the total number of shell commands.
func (s *Store) CountShellCommands() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM shell_commands").Scan(&count)
	return count, err
}

// CountShellCommandsByTimeRange returns the count of shell commands in a time range.
func (s *Store) CountShellCommandsByTimeRange(start, end int64) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM shell_commands
		WHERE timestamp >= ? AND timestamp <= ?`, start, end).Scan(&count)
	return count, err
}

// GetAllShellCommands retrieves all shell commands (for search).
func (s *Store) GetAllShellCommands() ([]*ShellCommand, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, command, shell_type, working_directory,
		       exit_code, duration_seconds, hostname, session_id, created_at
		FROM shell_commands
		ORDER BY timestamp DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query all shell commands: %w", err)
	}
	defer rows.Close()

	return scanShellCommands(rows)
}

// DeleteShellCommand deletes a single shell command by ID.
func (s *Store) DeleteShellCommand(id int64) error {
	result, err := s.db.Exec("DELETE FROM shell_commands WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete shell command: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no shell command found with ID %d", id)
	}

	return nil
}

// DeleteShellCommands deletes multiple shell commands by ID.
func (s *Store) DeleteShellCommands(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	// Build placeholders for IN clause
	placeholders := ""
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}

	query := fmt.Sprintf("DELETE FROM shell_commands WHERE id IN (%s)", placeholders)

	result, err := s.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete shell commands: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no shell commands found with the given IDs")
	}

	return nil
}

func scanShellCommands(rows *sql.Rows) ([]*ShellCommand, error) {
	var commands []*ShellCommand
	for rows.Next() {
		cmd := &ShellCommand{}
		err := rows.Scan(
			&cmd.ID, &cmd.Timestamp, &cmd.Command, &cmd.ShellType, &cmd.WorkingDirectory,
			&cmd.ExitCode, &cmd.DurationSeconds, &cmd.Hostname, &cmd.SessionID, &cmd.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan shell command: %w", err)
		}
		commands = append(commands, cmd)
	}
	return commands, rows.Err()
}
