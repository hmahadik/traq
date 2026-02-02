package service

import (
	"path/filepath"
	"regexp"
	"strings"
)

// AppNameMapping maps technical process names to user-friendly display names.
// This improves UX by showing "Chrome" instead of "google-chrome".
var AppNameMapping = map[string]string{
	// Browsers
	"chrome":               "Chrome",
	"google-chrome":        "Chrome",
	"google-chrome-stable": "Chrome",
	"chromium":             "Chromium",
	"chromium-browser":     "Chromium",
	"firefox":              "Firefox",
	"firefox-esr":          "Firefox",
	"brave":                "Brave",
	"brave-browser":        "Brave",
	"microsoft-edge":       "Edge",
	"msedge":               "Edge",
	"opera":                "Opera",
	"vivaldi":              "Vivaldi",
	"safari":               "Safari",

	// Terminals
	"tilix":            "Terminal",
	"gnome-terminal":   "Terminal",
	"konsole":          "Terminal",
	"xterm":            "Terminal",
	"urxvt":            "Terminal",
	"alacritty":        "Terminal",
	"kitty":            "Terminal",
	"terminator":       "Terminal",
	"xfce4-terminal":   "Terminal",
	"lxterminal":       "Terminal",
	"mate-terminal":    "Terminal",
	"terminology":      "Terminal",
	"hyper":            "Hyper Terminal",
	"warp":             "Warp",
	"iterm2":           "iTerm",
	"terminal":         "Terminal",
	"cmd.exe":          "Command Prompt",
	"powershell.exe":   "PowerShell",
	"windowsterminal":  "Windows Terminal",

	// Code Editors & IDEs
	"code":                    "VS Code",
	"code-oss":                "VS Code",
	"vscodium":                "VSCodium",
	"sublime_text":            "Sublime Text",
	"subl":                    "Sublime Text",
	"atom":                    "Atom",
	"gedit":                   "Text Editor",
	"kate":                    "Kate",
	"notepad++":               "Notepad++",
	"notepad.exe":             "Notepad",
	"vim":                     "Vim",
	"nvim":                    "Neovim",
	"emacs":                   "Emacs",
	"nano":                    "Nano",
	"jetbrains-idea":          "IntelliJ IDEA",
	"idea":                    "IntelliJ IDEA",
	"jetbrains-pycharm":       "PyCharm",
	"pycharm":                 "PyCharm",
	"jetbrains-webstorm":      "WebStorm",
	"webstorm":                "WebStorm",
	"jetbrains-goland":        "GoLand",
	"goland":                  "GoLand",
	"jetbrains-clion":         "CLion",
	"clion":                   "CLion",
	"jetbrains-rider":         "Rider",
	"rider":                   "Rider",
	"jetbrains-datagrip":      "DataGrip",
	"datagrip":                "DataGrip",
	"android-studio":          "Android Studio",
	"xcode":                   "Xcode",
	"eclipse":                 "Eclipse",
	"netbeans":                "NetBeans",
	"zed":                     "Zed",
	"cursor":                  "Cursor",

	// Communication
	"slack":                "Slack",
	"discord":              "Discord",
	"telegram-desktop":     "Telegram",
	"signal-desktop":       "Signal",
	"teams":                "Microsoft Teams",
	"zoom":                 "Zoom",
	"skype":                "Skype",
	"thunderbird":          "Thunderbird",
	"mailspring":           "Mailspring",
	"geary":                "Geary Mail",
	"evolution":            "Evolution",

	// Productivity
	"notion":               "Notion",
	"notion-app":           "Notion",
	"obsidian":             "Obsidian",
	"logseq":               "Logseq",
	"evernote":             "Evernote",
	"onenote":              "OneNote",
	"libreoffice-writer":   "LibreOffice Writer",
	"libreoffice-calc":     "LibreOffice Calc",
	"libreoffice-impress":  "LibreOffice Impress",
	"libreoffice":          "LibreOffice",
	"soffice":              "LibreOffice",
	"winword.exe":          "Microsoft Word",
	"excel.exe":            "Microsoft Excel",
	"powerpnt.exe":         "Microsoft PowerPoint",
	"outlook.exe":          "Microsoft Outlook",

	// Design & Creative
	"figma":                "Figma",
	"figma-linux":          "Figma",
	"gimp":                 "GIMP",
	"inkscape":             "Inkscape",
	"krita":                "Krita",
	"blender":              "Blender",
	"adobe-photoshop":      "Photoshop",
	"adobe-illustrator":    "Illustrator",
	"adobe-xd":             "Adobe XD",
	"sketch":               "Sketch",

	// Development Tools
	"postman":              "Postman",
	"insomnia":             "Insomnia",
	"dbeaver":              "DBeaver",
	"tableplus":            "TablePlus",
	"docker-desktop":       "Docker Desktop",
	"docker":               "Docker",
	"github-desktop":       "GitHub Desktop",
	"gitkraken":            "GitKraken",
	"sourcetree":           "Sourcetree",

	// File Managers
	"nautilus":             "Files",
	"dolphin":              "Dolphin",
	"thunar":               "Thunar",
	"nemo":                 "Files",
	"caja":                 "Files",
	"pcmanfm":              "PCManFM",
	"explorer.exe":         "File Explorer",
	"finder":               "Finder",

	// Media
	"spotify":              "Spotify",
	"vlc":                  "VLC",
	"mpv":                  "mpv",
	"rhythmbox":            "Rhythmbox",
	"audacity":             "Audacity",
	"obs":                  "OBS Studio",
	"obs-studio":           "OBS Studio",

	// System
	"gnome-control-center": "Settings",
	"gnome-settings":       "Settings",
	"systemsettings":       "System Settings",
	"gnome-system-monitor": "System Monitor",
	"htop":                 "htop",
	"ksysguard":            "System Monitor",

	// GNOME apps (org.gnome.* format)
	"org.gnome.nautilus":           "Files",
	"org.gnome.files":              "Files",
	"org.gnome.terminal":           "Terminal",
	"org.gnome.gedit":              "Text Editor",
	"org.gnome.evince":             "Document Viewer",
	"org.gnome.eog":                "Image Viewer",
	"org.gnome.calculator":         "Calculator",
	"org.gnome.settings":           "Settings",
	"org.gnome.software":           "Software",
	"org.gnome.tweaks":             "Tweaks",
	"org.gnome.baobab":             "Disk Usage Analyzer",
	"org.gnome.diskutility":        "Disks",
	"org.gnome.font-viewer":        "Fonts",
	"org.gnome.clocks":             "Clocks",
	"org.gnome.weather":            "Weather",
	"org.gnome.maps":               "Maps",
	"org.gnome.photos":             "Photos",
	"org.gnome.music":              "Music",
	"org.gnome.videos":             "Videos",
	"org.gnome.totem":              "Videos",
	"eog":                          "Image Viewer",
	"evince":                       "Document Viewer",

	// Portal/system services (usually hide these)
	"xdg-desktop-portal-gnome":     "System Service",
	"xdg-desktop-portal":           "System Service",

	// Traq itself
	"traq":                 "Traq",
}

// GetFriendlyAppName returns a user-friendly display name for a process name.
// If no mapping exists, it returns a cleaned-up version of the original name.
func GetFriendlyAppName(processName string) string {
	if processName == "" {
		return "Unknown"
	}

	// Normalize: lowercase and trim
	normalized := strings.ToLower(strings.TrimSpace(processName))

	// Remove common suffixes like -dev, -linux, -amd64, etc.
	normalized = cleanProcessName(normalized)

	// Check direct mapping
	if friendly, ok := AppNameMapping[normalized]; ok {
		return friendly
	}

	// Detect Chrome subprocess patterns:
	// - "google-chrome (/path/to/mcp-chrome-HASH)" — Playwright/MCP Chrome profiles
	// - "crx_EXTENSIONID" — Chrome extension app windows
	if friendly := detectChromeSubprocess(normalized); friendly != "" {
		return friendly
	}

	// Check if it's a path and extract the basename
	if strings.Contains(processName, "/") || strings.Contains(processName, "\\") {
		baseName := filepath.Base(processName)
		baseName = strings.TrimSuffix(baseName, filepath.Ext(baseName))
		normalizedBase := cleanProcessName(strings.ToLower(baseName))
		if friendly, ok := AppNameMapping[normalizedBase]; ok {
			return friendly
		}
		// Use cleaned basename as fallback
		return titleCase(normalizedBase)
	}

	// Fallback: return original with title case
	return titleCase(processName)
}

// cleanProcessName removes common suffixes from process names.
func cleanProcessName(name string) string {
	// Remove common dev/build suffixes
	suffixes := []string{
		"-dev-linux-amd64",
		"-dev-linux-arm64",
		"-dev-darwin-amd64",
		"-dev-darwin-arm64",
		"-dev-windows-amd64",
		"-linux-amd64",
		"-linux-arm64",
		"-darwin-amd64",
		"-darwin-arm64",
		"-windows-amd64",
		"-amd64",
		"-arm64",
		"-x86_64",
		"-dev",
		"-bin",
		".exe",
		".app",
	}

	result := name
	for _, suffix := range suffixes {
		result = strings.TrimSuffix(result, suffix)
	}

	return result
}

// titleCase converts a string to title case, handling hyphens and underscores.
func titleCase(s string) string {
	if s == "" {
		return s
	}

	// Replace hyphens and underscores with spaces for title casing
	s = strings.ReplaceAll(s, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")

	words := strings.Fields(s)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
		}
	}

	return strings.Join(words, " ")
}

// chromeProfilePattern matches Chrome WM_CLASS instance names that include a profile path,
// e.g. "google-chrome (/home/user/.cache/ms-playwright/mcp-chrome-93a1952)"
var chromeProfilePattern = regexp.MustCompile(`^(google-chrome|chromium|chrome)\s*\(`)

// crxPattern matches Chrome extension app window instance names,
// e.g. "crx_fcoeoabgfenejglbffodgkkbkcdhcgfn"
var crxPattern = regexp.MustCompile(`^crx_[a-p]{32}$`)

// detectChromeSubprocess checks if a normalized process name matches known
// Chrome subprocess patterns (MCP profiles, extension app windows, etc.)
// and returns the appropriate friendly name, or "" if no match.
func detectChromeSubprocess(normalized string) string {
	// Chrome with profile path in parens: "google-chrome (/path/to/profile)"
	if chromeProfilePattern.MatchString(normalized) {
		return "Chrome"
	}

	// Chrome extension app windows: "crx_<32-char-extension-id>"
	if crxPattern.MatchString(normalized) {
		return "Chrome Extension"
	}

	return ""
}
