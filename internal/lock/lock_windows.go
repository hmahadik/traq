//go:build windows

package lock

import (
	"fmt"
	"syscall"
	"unsafe"
)

var (
	modkernel32      = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW = modkernel32.NewProc("CreateMutexW")
)

const mutexName = "Global\\TraqInstanceLock"

// Acquire attempts to acquire a Windows named mutex.
// Named mutexes are kernel objects — the OS automatically releases them
// when the owning process exits (even on crash), so stale locks are impossible.
func (l *InstanceLock) Acquire() error {
	namePtr, err := syscall.UTF16PtrFromString(mutexName)
	if err != nil {
		return fmt.Errorf("failed to encode mutex name: %w", err)
	}

	// CreateMutexW(lpSecurityAttributes, bInitialOwner, lpName)
	// bInitialOwner=1 requests ownership on creation.
	// If the mutex already exists (another instance owns it),
	// GetLastError returns ERROR_ALREADY_EXISTS.
	handle, _, lastErr := procCreateMutexW.Call(
		0,     // no security attributes
		1,     // bInitialOwner = true
		uintptr(unsafe.Pointer(namePtr)),
	)

	if handle == 0 {
		return fmt.Errorf("failed to create instance lock: %w", lastErr)
	}

	if lastErr == syscall.ERROR_ALREADY_EXISTS {
		syscall.CloseHandle(syscall.Handle(handle))
		return fmt.Errorf("another instance of Traq is already running")
	}

	l.handle = handle
	return nil
}

// Release closes the named mutex handle. The OS also does this automatically
// if the process exits without calling Release.
func (l *InstanceLock) Release() {
	if l.handle != 0 {
		syscall.CloseHandle(syscall.Handle(l.handle))
		l.handle = 0
	}
}
