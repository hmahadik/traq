package tracker

import (
	"time"

	"traq/internal/platform"
)

// MockPlatform implements platform.Platform for testing.
type MockPlatform struct {
	dataDir           string
	configDir         string
	cacheDir          string
	activeWindow      *platform.WindowInfo
	activeWindowErr   error
	lastInputTime     time.Time
	lastInputErr      error
	shellHistoryPath  string
	shellType         string
	browserPaths      map[string]string
	openURLCalled     bool
	notificationCalls []struct{ Title, Body string }
}

func NewMockPlatform() *MockPlatform {
	return &MockPlatform{
		dataDir:      "/tmp/test-data",
		configDir:    "/tmp/test-config",
		cacheDir:     "/tmp/test-cache",
		lastInputTime: time.Now(),
		activeWindow: &platform.WindowInfo{
			Title:   "Test Window",
			AppName: "TestApp",
			Class:   "test-class",
			PID:     1234,
			X:       0,
			Y:       0,
			Width:   1920,
			Height:  1080,
			Monitor: "Display 0",
		},
		shellHistoryPath: "/home/test/.bash_history",
		shellType:        "bash",
		browserPaths:     make(map[string]string),
	}
}

func (m *MockPlatform) DataDir() string   { return m.dataDir }
func (m *MockPlatform) ConfigDir() string { return m.configDir }
func (m *MockPlatform) CacheDir() string  { return m.cacheDir }

func (m *MockPlatform) GetActiveWindow() (*platform.WindowInfo, error) {
	if m.activeWindowErr != nil {
		return nil, m.activeWindowErr
	}
	return m.activeWindow, nil
}

func (m *MockPlatform) GetLastInputTime() (time.Time, error) {
	if m.lastInputErr != nil {
		return time.Time{}, m.lastInputErr
	}
	return m.lastInputTime, nil
}

func (m *MockPlatform) GetShellHistoryPath() string { return m.shellHistoryPath }
func (m *MockPlatform) GetShellType() string        { return m.shellType }
func (m *MockPlatform) GetBrowserHistoryPaths() map[string]string { return m.browserPaths }

func (m *MockPlatform) OpenURL(url string) error {
	m.openURLCalled = true
	return nil
}

func (m *MockPlatform) ShowNotification(title, body string) error {
	m.notificationCalls = append(m.notificationCalls, struct{ Title, Body string }{title, body})
	return nil
}

// SetActiveWindow sets the active window for testing.
func (m *MockPlatform) SetActiveWindow(info *platform.WindowInfo) {
	m.activeWindow = info
}

// SetActiveWindowError sets an error to return from GetActiveWindow.
func (m *MockPlatform) SetActiveWindowError(err error) {
	m.activeWindowErr = err
}

// SetLastInputTime sets the last input time for testing.
func (m *MockPlatform) SetLastInputTime(t time.Time) {
	m.lastInputTime = t
}

// SetLastInputError sets an error to return from GetLastInputTime.
func (m *MockPlatform) SetLastInputError(err error) {
	m.lastInputErr = err
}
