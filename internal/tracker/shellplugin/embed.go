// Package shellplugin provides embedded shell plugin scripts.
package shellplugin

import (
	"embed"
	"errors"
)

//go:embed embed/*
var files embed.FS

// ShellKind enumerates supported plugin shells.
type ShellKind string

const (
	Bash       ShellKind = "bash"
	Zsh        ShellKind = "zsh"
	Fish       ShellKind = "fish"
	PowerShell ShellKind = "powershell"
)

var errUnknownShell = errors.New("unknown shell kind")

// Filename returns the on-disk filename used when installing the plugin.
func Filename(kind ShellKind) string {
	switch kind {
	case Bash:
		return "plugin.bash"
	case Zsh:
		return "plugin.zsh"
	case Fish:
		return "plugin.fish"
	case PowerShell:
		return "plugin.ps1"
	}
	return ""
}

// Script returns the plugin contents for the given shell.
func Script(kind ShellKind) ([]byte, error) {
	var p string
	switch kind {
	case Bash:
		p = "embed/traq.bash"
	case Zsh:
		p = "embed/traq.zsh"
	case Fish:
		p = "embed/traq.fish"
	case PowerShell:
		p = "embed/Traq.ps1"
	default:
		return nil, errUnknownShell
	}
	return files.ReadFile(p)
}
