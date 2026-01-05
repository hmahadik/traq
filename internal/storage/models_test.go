package storage

import (
	"database/sql"
	"testing"
)

func TestParseJSONStringArray(t *testing.T) {
	tests := []struct {
		name     string
		input    sql.NullString
		expected []string
	}{
		{
			name:     "valid array",
			input:    sql.NullString{String: `["a","b","c"]`, Valid: true},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "empty array",
			input:    sql.NullString{String: `[]`, Valid: true},
			expected: []string{},
		},
		{
			name:     "null string",
			input:    sql.NullString{Valid: false},
			expected: nil,
		},
		{
			name:     "empty valid string",
			input:    sql.NullString{String: "", Valid: true},
			expected: nil,
		},
		{
			name:     "invalid json",
			input:    sql.NullString{String: "not json", Valid: true},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ParseJSONStringArray(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("got %v, want %v", result, tt.expected)
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("got %v, want %v", result, tt.expected)
					return
				}
			}
		})
	}
}

func TestParseJSONInt64Array(t *testing.T) {
	tests := []struct {
		name     string
		input    sql.NullString
		expected []int64
	}{
		{
			name:     "valid array",
			input:    sql.NullString{String: `[1,2,3]`, Valid: true},
			expected: []int64{1, 2, 3},
		},
		{
			name:     "empty array",
			input:    sql.NullString{String: `[]`, Valid: true},
			expected: []int64{},
		},
		{
			name:     "null string",
			input:    sql.NullString{Valid: false},
			expected: nil,
		},
		{
			name:     "invalid json",
			input:    sql.NullString{String: "not json", Valid: true},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ParseJSONInt64Array(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("got %v, want %v", result, tt.expected)
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("got %v, want %v", result, tt.expected)
					return
				}
			}
		})
	}
}

func TestToJSONString(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected string
	}{
		{
			name:     "string slice",
			input:    []string{"a", "b", "c"},
			expected: `["a","b","c"]`,
		},
		{
			name:     "int64 slice",
			input:    []int64{1, 2, 3},
			expected: `[1,2,3]`,
		},
		{
			name:     "empty slice",
			input:    []string{},
			expected: `[]`,
		},
		{
			name:     "nil",
			input:    nil,
			expected: `null`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToJSONString(tt.input)
			if result != tt.expected {
				t.Errorf("got %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestNullString(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		expectedValid bool
	}{
		{
			name:          "non-empty",
			input:         "hello",
			expectedValid: true,
		},
		{
			name:          "empty",
			input:         "",
			expectedValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NullString(tt.input)
			if result.Valid != tt.expectedValid {
				t.Errorf("got Valid=%v, want %v", result.Valid, tt.expectedValid)
			}
			if result.String != tt.input {
				t.Errorf("got String=%v, want %v", result.String, tt.input)
			}
		})
	}
}

func TestNullInt64(t *testing.T) {
	result := NullInt64(42)
	if !result.Valid {
		t.Error("expected Valid=true")
	}
	if result.Int64 != 42 {
		t.Errorf("got %d, want 42", result.Int64)
	}
}
