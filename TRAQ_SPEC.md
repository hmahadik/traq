# Traq: Comprehensive Product Specification

> **Traq** is an intelligent, privacy-first activity tracker that captures what you do on your computer, organizes it into meaningful sessions, and uses AI to help you understand how you spend your time.

## Vision Statement

Traq is the activity tracker for people who want to understand their work patterns without sacrificing privacy. Unlike cloud-based alternatives, Traq runs entirely on your machine, stores all data locally, and provides AI-powered insights using bundled models that never send your data to external servers.

---

## Feature Specification

Features are ordered by importance, grouped into tiers:
- **P0 (Critical)**: Core functionality that defines the product
- **P1 (Essential)**: Features that make the product complete
- **P2 (Important)**: Features that significantly enhance value
- **P3 (Nice-to-Have)**: Features that polish the experience

---

## P0: Critical Features (1-50)

### Core Capture Engine

1. **Automatic Screenshot Capture** - Periodically capture the screen at configurable intervals (10-300 seconds) to create a visual record of activity
2. **Configurable Capture Interval** - Allow users to set how frequently screenshots are taken based on their privacy/detail preferences
3. **Active Window Context Capture** - Record the currently focused window title and application name with each screenshot
4. **Session-Based Organization** - Group related activity into sessions based on continuous work periods
5. **AFK Detection** - Automatically detect when the user is away from keyboard and pause tracking
6. **Session Auto-Resume** - Resume the previous session if the user returns within a configurable time window
7. **Perceptual Duplicate Detection** - Use dhash algorithm to skip near-identical screenshots, reducing storage and noise
8. **Local-Only Storage** - Store all data exclusively on the user's machine, never uploading to external servers
9. **SQLite Database** - Use SQLite for reliable, portable, query-able data storage
10. **Date-Organized File Storage** - Store screenshots in YYYY/MM/DD folder hierarchy for easy browsing

### AI-Powered Understanding

11. **AI Session Summaries** - Generate natural language summaries of what the user did during each session
12. **Bundled AI Model** - Ship with a local LLM (llama.cpp + small model) that works offline without setup
13. **Activity Tagging** - Automatically categorize sessions with relevant tags (coding, browsing, communication, etc.)
14. **Confidence Indicators** - Show confidence level for AI-generated summaries so users know reliability
15. **Context-Aware Summaries** - Include window titles, app names, and other metadata in summary generation

### Timeline & Visualization

16. **Daily Timeline View** - Show all sessions for a selected day in chronological order
17. **Session Cards** - Display session summaries as expandable cards with key metadata
18. **Screenshot Thumbnails** - Show small previews of screenshots within session cards
19. **Calendar Heatmap** - Display activity intensity across days in a calendar view
20. **Date Navigation** - Easy navigation between days (previous/next, date picker, "today" button)

### Cross-Platform Support

21. **Linux Support** - Full functionality on Linux with X11 window tracking
22. **macOS Support** - Full functionality on macOS using Accessibility APIs
23. **Windows Support** - Full functionality on Windows using Win32 APIs
24. **Single Binary Distribution** - Distribute as a single executable with no runtime dependencies
25. **Native Desktop App** - Use native webview (Wails) instead of Electron for smaller footprint

### Core Settings

26. **Enable/Disable Capture** - Toggle screenshot capture on/off without closing the app
27. **Quality Settings** - Configure screenshot compression quality (file size vs. clarity tradeoff)
28. **Duplicate Threshold** - Adjust sensitivity of perceptual duplicate detection
29. **AFK Timeout Configuration** - Set how long before user is considered away
30. **Minimum Session Duration** - Set minimum duration for sessions to be saved

### Data Persistence

31. **Session Persistence** - Reliably save sessions even on unexpected app termination
32. **Screenshot Persistence** - Ensure screenshots are written to disk before being referenced
33. **Graceful Shutdown** - Properly close sessions and flush data when app exits
34. **Database Migrations** - Support schema updates across app versions
35. **Data Integrity** - Use transactions and foreign keys to maintain data consistency

### Basic Analytics

36. **Daily Statistics** - Show total screenshots, sessions, and active time for each day
37. **Top Applications** - Display most-used applications with time spent
38. **Session Count** - Track number of distinct work sessions per day
39. **Active Time Calculation** - Calculate actual working time excluding AFK periods
40. **Screenshot Count** - Track total screenshots captured

### Basic UI/UX

41. **Dark/Light Theme** - Support system theme preference and manual override
42. **Responsive Layout** - Adapt to different window sizes
43. **Loading States** - Show skeleton loaders while data loads
44. **Error Handling** - Display user-friendly error messages
45. **Toast Notifications** - Provide feedback for user actions

### System Integration

46. **System Tray Icon** - Run in background with system tray presence
47. **Tray Menu** - Quick access to common actions from tray icon
48. **Auto-Start Option** - Option to launch app on system boot
49. **Background Operation** - Continue tracking when main window is closed
50. **Daemon Architecture** - Separate tracking daemon from UI for reliability

---

## P1: Essential Features (51-100)

### Extended Data Sources

51. **Shell Command Tracking** - Record commands executed in terminal/shell
52. **Git Activity Tracking** - Track commits, branches, and repository activity
53. **File Event Tracking** - Monitor file creation, modification, and deletion
54. **Browser History Tracking** - Record visited URLs and page titles
55. **Multi-Shell Support** - Support bash, zsh, fish, and PowerShell history
56. **Multi-Browser Support** - Support Chrome, Firefox, Safari, Edge, Brave
57. **Git Repository Registration** - Manually add repositories to track
58. **File Watch Directories** - Configure which directories to monitor for file events
59. **Sensitive Command Filtering** - Automatically exclude commands containing passwords/tokens
60. **Navigation Command Filtering** - Option to exclude trivial commands (cd, ls, pwd)

### Advanced Analytics

61. **Hourly Activity Chart** - Visualize activity distribution across hours of day
62. **Weekly Statistics View** - Aggregate stats across a week
63. **Monthly Statistics View** - Aggregate stats across a month
64. **App Usage Pie Chart** - Visual breakdown of time by application
65. **App Usage Table** - Sortable list of applications with durations
66. **Activity Heatmap** - 7x24 grid showing activity patterns by day/hour
67. **Data Source Statistics** - Aggregate stats for shell, git, files, browser
68. **Top Shell Commands** - Most frequently used commands
69. **Top Git Repositories** - Most active repositories
70. **Top Domains Visited** - Most frequently visited websites

### Productivity Insights

71. **Productivity Score** - Calculate daily productivity rating (1-5 scale)
72. **App Categorization** - Classify apps as productive/neutral/distracting
73. **Productive Time Tracking** - Track time spent in productive apps
74. **Distraction Time Tracking** - Track time spent in distracting apps
75. **Focus Distribution** - Analyze context-switching patterns
76. **Top Windows Analysis** - Track most-used window titles
77. **Time Distribution Chart** - Show app usage patterns throughout the day
78. **Activity Tags Analysis** - Aggregate and visualize session tags

### Report Generation

79. **Natural Language Date Parsing** - Parse inputs like "yesterday", "last week", "past 3 days"
80. **Summary Report Type** - Generate high-level activity overview
81. **Detailed Report Type** - Generate comprehensive report with all metrics
82. **Standup Report Type** - Generate team standup-formatted report
83. **Markdown Export** - Export reports as Markdown files
84. **HTML Export** - Export reports as styled HTML
85. **PDF Export** - Export reports as PDF documents
86. **JSON Export** - Export reports as structured JSON
87. **Report History** - View and manage previously generated reports
88. **Quick Report Presets** - One-click generation for common report types

### Session Deep Dive

89. **Session Detail View** - Dedicated page for exploring a single session
90. **Session Screenshots Gallery** - Browse all screenshots from a session
91. **Activity Log Table** - View all focus events within a session
92. **Session Context** - See shell commands, git commits, files changed during session
93. **Session Deletion** - Remove sessions and associated data
94. **Screenshot Deletion** - Remove individual screenshots

### Enhanced UI

95. **Keyboard Navigation** - Navigate timeline with keyboard shortcuts (j/k, arrows)
96. **Image Lightbox** - Full-screen screenshot viewer with navigation
97. **Tag Filtering** - Filter sessions by activity tags
98. **Time Period Filtering** - Filter by morning/afternoon/evening
99. **App Filtering** - Filter sessions by application
100. **Collapsible Sections** - Expand/collapse detail sections

---

## P2: Important Features (101-150)

### AI Configuration

101. **External Ollama Support** - Connect to external Ollama server for inference
102. **Cloud API Support** - Option to use Anthropic/OpenAI APIs for summaries
103. **Model Selection** - Choose which AI model to use for summaries
104. **Model Download Manager** - Download and manage AI models from UI
105. **Download Progress Indicator** - Show progress when downloading models
106. **Inference Status Display** - Show whether AI is available and which model is active
107. **Custom API Endpoints** - Configure custom API endpoints for cloud providers
108. **API Key Management** - Securely store and manage API keys
109. **Inference Time Tracking** - Record how long each summary took to generate
110. **Model Attribution** - Track which model generated each summary

### Enhanced Capture

111. **Screenshot Quality Presets** - Quick selection (low/medium/high) for quality
112. **Thumbnail Generation** - Create small thumbnails for faster UI loading
113. **WebP Format** - Use modern WebP format for efficient storage
114. **Monitor Selection** - Choose which monitor to capture on multi-monitor setups
115. **Window Geometry Capture** - Record window position and size
116. **Monitor Info Capture** - Record which monitor the window was on
117. **Process ID Capture** - Record the process ID of active window
118. **Window Class Capture** - Record window class for better app identification
119. **Force Capture Button** - Manually trigger an immediate screenshot
120. **Capture Pause/Resume** - Temporarily pause capture without stopping daemon

### Data Source Configuration

121. **Shell History Path Override** - Custom path to shell history file
122. **Shell Exclude Patterns** - Regex patterns for commands to exclude
123. **Git Search Paths** - Directories to search for git repositories
124. **Git Auto-Discovery** - Automatically find git repos in specified paths
125. **Git Depth Limit** - Limit how deep to search for repositories
126. **File Watch Patterns** - Include/exclude patterns for file tracking
127. **File Extension Filtering** - Filter file events by extension
128. **Browser Selection** - Choose which browsers to track
129. **Browser History Limit** - Limit how far back to read browser history
130. **Domain Exclusion** - Exclude specific domains from browser tracking

### Storage & Performance

131. **Storage Statistics** - Show database and screenshot storage usage
132. **Data Directory Location** - Display and optionally change data location
133. **Open Data Directory** - Quick access to open data folder in file manager
134. **Database Optimization** - Periodic VACUUM and optimization
135. **Index Optimization** - Proper indexing for fast queries
136. **Lazy Image Loading** - Load images on-demand for better performance
137. **Pagination** - Paginate large result sets
138. **Query Caching** - Cache frequent queries with TanStack Query
139. **Background Refresh** - Refresh data in background while viewing
140. **Stale Time Configuration** - Configure how long cached data is considered fresh

### Enhanced Timeline

141. **Hour Groups** - Group screenshots by hour within day view
142. **Timeline Bands** - Visual representation of sessions across hours
143. **Session Duration Display** - Show duration in human-readable format
144. **Time Range Display** - Show session start/end times
145. **Top Apps in Session** - Show most-used apps per session
146. **Data Source Indicators** - Show which data sources have data for session
147. **Empty State Handling** - Friendly messages when no data exists
148. **Date Range Selection** - Select custom date ranges for views
149. **Quick Date Jumps** - Jump to specific dates quickly
150. **Calendar Month Navigation** - Navigate between months in calendar view

---

## P3: Nice-to-Have Features (151-200)

### Advanced Analytics

151. **Trend Analysis** - Show activity trends over time
152. **Week-over-Week Comparison** - Compare current week to previous
153. **Month-over-Month Comparison** - Compare current month to previous
154. **Average Session Duration** - Calculate average session length
155. **Average Daily Active Time** - Calculate average working hours
156. **Peak Productivity Hours** - Identify most productive times of day
157. **Context Switch Frequency** - Track how often focus changes
158. **Deep Work Detection** - Identify periods of sustained focus
159. **Meeting Time Detection** - Identify time spent in video calls
160. **Break Pattern Analysis** - Analyze break-taking patterns

### Enhanced Reports

161. **Scheduled Reports** - Auto-generate reports on schedule
162. **Report Templates** - Custom templates for report generation
163. **Report Sharing** - Share reports via link or export
164. **Team Reports** - Aggregate reports for team visibility
165. **Goal Tracking** - Set and track productivity goals
166. **Goal Progress Reports** - Reports showing progress toward goals
167. **Custom Date Range Reports** - Reports for arbitrary date ranges
168. **Comparative Reports** - Compare two time periods
169. **Project-Based Reports** - Reports filtered by project/repository
170. **Client-Based Reports** - Reports organized by client/project

### Privacy & Security

171. **Screenshot Encryption** - Encrypt screenshots at rest
172. **Database Encryption** - Encrypt SQLite database
173. **Auto-Delete Old Data** - Automatically purge data older than threshold
174. **Retention Policies** - Configure how long to keep different data types
175. **Privacy Mode** - Temporarily disable all tracking
176. **Sensitive Window Detection** - Auto-pause when banking/password apps active
177. **Blur Sensitive Content** - Option to blur parts of screenshots
178. **Export Encryption** - Encrypt exported data
179. **Secure API Key Storage** - Use system keychain for API keys
180. **Audit Log** - Track access to sensitive features

### Customization

181. **Custom Categories** - User-defined app categories
182. **Category Rules** - Rules for auto-categorizing apps
183. **Custom Tags** - User-defined session tags
184. **Tag Rules** - Rules for auto-applying tags
185. **Custom Shortcuts** - Configurable keyboard shortcuts
186. **Dashboard Customization** - Rearrange analytics dashboard widgets
187. **Widget Selection** - Choose which widgets to display
188. **Color Schemes** - Custom color themes beyond dark/light
189. **Font Size Settings** - Adjust UI font sizes
190. **Compact Mode** - Condensed UI for smaller screens

### Integrations

191. **Calendar Integration** - Import calendar events for context
192. **Task Manager Integration** - Link sessions to tasks/tickets
193. **Slack Integration** - Update Slack status based on activity
194. **Webhook Support** - Trigger webhooks on events
195. **API Access** - REST/GraphQL API for external tools
196. **CLI Tool** - Command-line interface for scripting
197. **Import from Other Trackers** - Import data from RescueTime, ActivityWatch, etc.
198. **Export All Data** - Complete data export for backup/migration
199. **Sync Between Devices** - Optional sync across multiple machines
200. **Plugin System** - Extensibility through plugins

### Polish & Edge Cases

201. **Onboarding Flow** - Guide new users through setup
202. **Feature Discovery** - Highlight new features to users
203. **Contextual Help** - In-app help and documentation
204. **Diagnostic Mode** - Debug mode for troubleshooting
205. **Crash Reporting** - Optional anonymous crash reports
206. **Update Notifications** - Notify users of new versions
207. **Auto-Update** - Automatic app updates
208. **Offline Indicator** - Show when AI/services unavailable
209. **Network Error Handling** - Graceful handling of network issues
210. **Startup Performance** - Fast app launch time

### Advanced Session Management

211. **Manual Session Creation** - Create sessions manually
212. **Session Merging** - Combine multiple sessions
213. **Session Splitting** - Split a session into multiple
214. **Session Tagging** - Manually tag sessions
215. **Session Notes** - Add notes to sessions
216. **Session Bookmarking** - Bookmark important sessions
217. **Session Search** - Full-text search across sessions
218. **Session Archiving** - Archive old sessions
219. **Session Restore** - Restore deleted sessions
220. **Session Export** - Export individual sessions

### Enhanced Screenshot Features

221. **Screenshot Annotation** - Add notes to screenshots
222. **Screenshot Tagging** - Tag individual screenshots
223. **Screenshot Search** - Search screenshots by content (OCR)
224. **Screenshot Comparison** - Compare two screenshots
225. **Screenshot Timeline** - Scrubber-style screenshot navigation
226. **Screenshot Slideshow** - Auto-play screenshots as slideshow
227. **Screenshot Zoom** - Zoom and pan within screenshots
228. **Screenshot Crop** - Crop screenshots after capture
229. **Multi-Monitor Capture** - Capture all monitors simultaneously
230. **Region Capture** - Capture specific screen region only

### Developer Features

231. **Debug Panel** - View internal state for debugging
232. **Log Viewer** - View application logs
233. **Database Browser** - Browse raw database tables
234. **Query Console** - Run custom SQL queries
235. **Event Stream** - Real-time stream of captured events
236. **Performance Metrics** - View app performance stats
237. **Memory Usage** - Monitor memory consumption
238. **CPU Usage** - Monitor CPU utilization
239. **Storage Metrics** - Detailed storage breakdown
240. **API Documentation** - Built-in API docs

### Accessibility

241. **Screen Reader Support** - Full screen reader compatibility
242. **High Contrast Mode** - Enhanced contrast option
243. **Reduced Motion** - Respect reduced motion preferences
244. **Keyboard-Only Navigation** - Full keyboard accessibility
245. **Focus Indicators** - Clear focus states
246. **ARIA Labels** - Proper accessibility labels
247. **Skip Links** - Skip navigation for keyboard users
248. **Text Scaling** - Support system text scaling
249. **Color Blind Modes** - Alternative color schemes
250. **Voice Control** - Voice command support

---

## Technical Requirements

### Performance Targets

- App launch: < 2 seconds
- Screenshot capture: < 500ms
- Timeline load: < 1 second for 100 sessions
- Database query: < 100ms for typical queries
- Memory usage: < 200MB during normal operation
- Binary size: < 50MB (excluding AI models)

### Storage Requirements

- Screenshots: ~50-100KB each (WebP @ quality 80)
- Thumbnails: ~5-10KB each
- Database: ~1MB per 1000 events
- AI Model (bundled): ~2GB

### Compatibility

- Linux: Ubuntu 20.04+, Fedora 35+, Arch (X11 required)
- macOS: 11.0+ (Big Sur)
- Windows: 10 version 1903+

---

## Data Model Summary

### Core Entities

| Entity | Description |
|--------|-------------|
| Session | A continuous period of user activity |
| Screenshot | A captured screen image with metadata |
| Summary | AI-generated description of a session |
| WindowFocusEvent | A period of focus on a specific window |
| ShellCommand | A command executed in terminal |
| GitCommit | A commit in a tracked repository |
| FileEvent | A file system change event |
| BrowserVisit | A visited web page |
| Report | A generated report document |

### Relationships

```
Session (1) ←→ (N) Screenshot
Session (1) ←→ (1) Summary
Session (1) ←→ (N) WindowFocusEvent
Session (1) ←→ (N) ShellCommand
Session (1) ←→ (N) GitCommit
Session (1) ←→ (N) FileEvent
Session (1) ←→ (N) BrowserVisit
```

---

## Success Metrics

### User Experience

- Users can understand their day in < 1 minute of reviewing
- AI summaries are accurate 90%+ of the time
- Zero data loss from crashes or unexpected shutdowns
- App runs without user intervention once configured

### Technical

- 99.9% capture success rate
- < 1% CPU usage during idle tracking
- Zero external network requests (in offline mode)
- All data recoverable from local storage

---

## Non-Goals

Traq intentionally does NOT:

- Track keystrokes or mouse movements at granular level
- Record audio or video
- Sync data to cloud by default
- Share data with third parties
- Require account creation
- Include ads or upsells
- Phone home for analytics
- Require internet connection for core features
