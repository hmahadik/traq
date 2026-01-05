/**
 * Application Constants
 */

// Default capture settings
export const DEFAULT_CAPTURE_INTERVAL = 30; // seconds
export const DEFAULT_CAPTURE_QUALITY = 80; // percent
export const DEFAULT_AFK_TIMEOUT = 180; // seconds (3 minutes)
export const DEFAULT_DUPLICATE_THRESHOLD = 3; // dhash distance

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_SCREENSHOTS_PER_PAGE = 50;

// Time ranges for reports
export const TIME_RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this week' },
  { label: 'Last 7 Days', value: 'last 7 days' },
  { label: 'Last 30 Days', value: 'last 30 days' },
  { label: 'This Month', value: 'this month' },
] as const;

// Report types
export const REPORT_TYPES = [
  { label: 'Summary', value: 'summary', description: 'High-level overview of activity' },
  { label: 'Detailed', value: 'detailed', description: 'In-depth breakdown with all data' },
  { label: 'Standup', value: 'standup', description: 'Quick summary for daily standups' },
] as const;

// Export formats
export const EXPORT_FORMATS = [
  { label: 'Markdown', value: 'markdown', extension: '.md' },
  { label: 'HTML', value: 'html', extension: '.html' },
  { label: 'PDF', value: 'pdf', extension: '.pdf' },
  { label: 'JSON', value: 'json', extension: '.json' },
] as const;

// Chart colors
export const CHART_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#a4de6c',
  '#d0ed57',
];

// Calendar heatmap intensity colors
export const HEATMAP_COLORS = {
  0: 'bg-muted',
  1: 'bg-green-100 dark:bg-green-900/30',
  2: 'bg-green-300 dark:bg-green-700/50',
  3: 'bg-green-500 dark:bg-green-600/70',
  4: 'bg-green-700 dark:bg-green-500',
};

// App categories for grouping
export const APP_CATEGORIES = {
  development: ['VS Code', 'Visual Studio Code', 'IntelliJ', 'PyCharm', 'WebStorm', 'Sublime Text', 'Atom', 'Vim', 'Neovim'],
  browsers: ['Firefox', 'Chrome', 'Safari', 'Edge', 'Opera', 'Brave'],
  communication: ['Slack', 'Discord', 'Teams', 'Zoom', 'Skype', 'Telegram', 'Signal'],
  productivity: ['Notion', 'Obsidian', 'Evernote', 'Todoist', 'Trello', 'Asana'],
  terminals: ['Terminal', 'iTerm2', 'Konsole', 'GNOME Terminal', 'Alacritty', 'Kitty', 'Warp'],
  design: ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'GIMP', 'Inkscape'],
  media: ['Spotify', 'VLC', 'mpv', 'YouTube', 'Netflix'],
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  navigation: {
    previousDay: ['ArrowLeft', 'h'],
    nextDay: ['ArrowRight', 'l'],
    previousSession: ['ArrowUp', 'k'],
    nextSession: ['ArrowDown', 'j'],
  },
  actions: {
    openSettings: ['s'],
    openSearch: ['/', 'cmd+k'],
    generateReport: ['r'],
    close: ['Escape'],
  },
};
