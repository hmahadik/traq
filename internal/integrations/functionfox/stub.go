package functionfox

import (
	"context"
	"fmt"
)

// StubClient is an in-memory client returning canned data. It exists so the
// settings UI can be exercised end-to-end before the real Plan C client is wired.
//
// The canned data is intentionally minimal: 3 customers, 2-3 jobs each, 3 tasks
// each. Numbers and names are illustrative — the real client will return the
// user's actual FunctionFox account contents.
type StubClient struct{}

func NewStubClient() *StubClient {
	return &StubClient{}
}

func (c *StubClient) TestConnection(ctx context.Context) error {
	return nil
}

func (c *StubClient) ListCustomers(ctx context.Context) ([]Customer, error) {
	return []Customer{
		{ID: "1001", Name: "Acme Corp"},
		{ID: "1002", Name: "Globex"},
		{ID: "1003", Name: "Internal"},
	}, nil
}

func (c *StubClient) ListJobs(ctx context.Context, customerID string) ([]Job, error) {
	jobs := map[string][]Job{
		"1001": {
			{ID: "2001", CustomerID: "1001", Name: "Acme Website Redesign", Code: "00120"},
			{ID: "2002", CustomerID: "1001", Name: "Acme API Integration", Code: "00121"},
		},
		"1002": {
			{ID: "2010", CustomerID: "1002", Name: "Globex Mobile App", Code: "00200"},
			{ID: "2011", CustomerID: "1002", Name: "Globex Brand Refresh", Code: "00201"},
			{ID: "2012", CustomerID: "1002", Name: "Globex Strategy Workshop", Code: "00202"},
		},
		"1003": {
			{ID: "2020", CustomerID: "1003", Name: "Internal Tools", Code: "00500"},
			{ID: "2021", CustomerID: "1003", Name: "R&D Time", Code: "00501"},
		},
	}
	result, ok := jobs[customerID]
	if !ok {
		return nil, fmt.Errorf("unknown customer: %s", customerID)
	}
	return result, nil
}

func (c *StubClient) ListTasks(ctx context.Context, customerID, jobID string) ([]Task, error) {
	// Same task set per job — stubs don't need realism here.
	return []Task{
		{ID: "3001", JobID: jobID, Name: "Development"},
		{ID: "3002", JobID: jobID, Name: "Design"},
		{ID: "3003", JobID: jobID, Name: "Project Management"},
	}, nil
}
