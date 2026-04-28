package functionfox

import (
	"context"
	"testing"
)

func TestStubClient_TestConnection(t *testing.T) {
	c := NewStubClient()
	if err := c.TestConnection(context.Background()); err != nil {
		t.Fatalf("TestConnection: %v", err)
	}
}

func TestStubClient_ListCustomers(t *testing.T) {
	c := NewStubClient()
	customers, err := c.ListCustomers(context.Background())
	if err != nil {
		t.Fatalf("ListCustomers: %v", err)
	}
	if len(customers) != 3 {
		t.Errorf("expected 3 customers, got %d", len(customers))
	}
}

func TestStubClient_ListJobs_ValidCustomer(t *testing.T) {
	c := NewStubClient()
	jobs, err := c.ListJobs(context.Background(), "1002")
	if err != nil {
		t.Fatalf("ListJobs: %v", err)
	}
	if len(jobs) != 3 {
		t.Errorf("expected 3 jobs for customer 1002, got %d", len(jobs))
	}
	for _, j := range jobs {
		if j.CustomerID != "1002" {
			t.Errorf("job %q has wrong CustomerID %q", j.ID, j.CustomerID)
		}
	}
}

func TestStubClient_ListJobs_InvalidCustomer(t *testing.T) {
	c := NewStubClient()
	_, err := c.ListJobs(context.Background(), "9999")
	if err == nil {
		t.Fatal("expected error for unknown customer, got nil")
	}
}

func TestStubClient_ListTasks(t *testing.T) {
	c := NewStubClient()
	tasks, err := c.ListTasks(context.Background(), "1001", "2001")
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(tasks) != 3 {
		t.Errorf("expected 3 tasks, got %d", len(tasks))
	}
	for _, task := range tasks {
		if task.JobID != "2001" {
			t.Errorf("task %q has wrong JobID %q", task.ID, task.JobID)
		}
	}
}

// Verify the stub satisfies the Client interface (compile-time check).
var _ Client = (*StubClient)(nil)
