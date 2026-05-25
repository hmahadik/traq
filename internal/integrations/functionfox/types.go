// Package functionfox provides a client interface for the FunctionFox timesheet API.
// This package contains both the interface used throughout the app and a stub
// implementation returning canned data. The real HTTP-backed client lives elsewhere.
package functionfox

// Customer represents a FunctionFox client/customer.
type Customer struct {
	ID   string
	Name string
}

// Job represents a FunctionFox project (called "job" in FF terminology) under a customer.
type Job struct {
	ID         string
	CustomerID string
	Name       string
	Code       string // e.g., "00086" — short numeric code shown in FF UI
}

// Task represents a FunctionFox task (activity type) within a job.
type Task struct {
	ID    string
	JobID string
	Name  string
}

// Credentials carries authentication parameters for the FunctionFox API.
// In Plan B these come from plain config; Plan C will store the password in OS keychain.
type Credentials struct {
	Username  string
	Password  string
	AccountID string // FF "Organization #" — e.g., "76111"
}
