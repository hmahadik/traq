package functionfox

import "context"

// Client is the interface exposed to the rest of the app. The HTTP-backed
// implementation lives in this same package (Plan C); the stub below is used
// until credentials are configured and Plan C lands.
type Client interface {
	// TestConnection verifies credentials and connectivity. Returns nil on success.
	TestConnection(ctx context.Context) error
	// ListCustomers returns all customers visible to the authenticated user.
	ListCustomers(ctx context.Context) ([]Customer, error)
	// ListJobs returns all jobs under the given customer.
	ListJobs(ctx context.Context, customerID string) ([]Job, error)
	// ListTasks returns all tasks within the given job.
	ListTasks(ctx context.Context, customerID, jobID string) ([]Task, error)
}
