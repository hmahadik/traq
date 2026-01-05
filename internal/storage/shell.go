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
