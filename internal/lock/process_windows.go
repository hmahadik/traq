//go:build windows

package lock

import (
	"syscall"
	"unsafe"
)

const (
	processQueryLimitedInformation = 0x1000
	stillActive                    = 259
)

var modkernel32 = syscall.NewLazyDLL("kernel32.dll")
var procGetExitCodeProcess = modkernel32.NewProc("GetExitCodeProcess")

// isProcessRunning checks if a process with the given PID is still alive.
// On Windows, we open the process handle and check its exit code.
// STILL_ACTIVE (259) means the process hasn't exited yet.
func isProcessRunning(pid int) bool {
	handle, err := syscall.OpenProcess(processQueryLimitedInformation, false, uint32(pid))
	if err != nil {
		return false // process doesn't exist or access denied
	}
	defer syscall.CloseHandle(handle)

	var exitCode uint32
	r1, _, _ := procGetExitCodeProcess.Call(uintptr(handle), uintptr(unsafe.Pointer(&exitCode)))
	if r1 == 0 {
		return false // API call failed
	}
	return exitCode == stillActive
}
