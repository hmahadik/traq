package storage

import (
	"testing"
)

func TestGetConfig(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Get non-existent config
	val, err := store.GetConfig("test_key")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != "" {
		t.Errorf("expected empty string, got %s", val)
	}

	// Set and get config
	err = store.SetConfig("test_key", "test_value")
	if err != nil {
		t.Fatalf("failed to set config: %v", err)
	}

	val, err = store.GetConfig("test_key")
	if err != nil {
		t.Fatalf("failed to get config: %v", err)
	}
	if val != "test_value" {
		t.Errorf("expected 'test_value', got %s", val)
	}
}

func TestSetConfig(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Set config
	err := store.SetConfig("key1", "value1")
	if err != nil {
		t.Fatalf("failed to set config: %v", err)
	}

	// Update config
	err = store.SetConfig("key1", "value2")
	if err != nil {
		t.Fatalf("failed to update config: %v", err)
	}

	val, _ := store.GetConfig("key1")
	if val != "value2" {
		t.Errorf("expected 'value2', got %s", val)
	}
}

func TestGetAllConfig(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Set multiple configs
	store.SetConfig("key1", "value1")
	store.SetConfig("key2", "value2")
	store.SetConfig("key3", "value3")

	configs, err := store.GetAllConfig()
	if err != nil {
		t.Fatalf("failed to get all config: %v", err)
	}
	if len(configs) != 3 {
		t.Errorf("expected 3 configs, got %d", len(configs))
	}
	if configs["key1"] != "value1" {
		t.Errorf("expected key1=value1")
	}
}

func TestDeleteConfig(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	store.SetConfig("key1", "value1")

	err := store.DeleteConfig("key1")
	if err != nil {
		t.Fatalf("failed to delete config: %v", err)
	}

	val, _ := store.GetConfig("key1")
	if val != "" {
		t.Errorf("expected empty string after delete, got %s", val)
	}
}
