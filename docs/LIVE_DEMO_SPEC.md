# Live Demo Specification

This document outlines the implementation plan for a static demo version of Activity Tracker that can be hosted on GitHub Pages.

## Overview

The demo provides a fully interactive preview of Activity Tracker without requiring a backend server. It uses pre-rendered HTML templates with mock JSON data to simulate the full experience.

## Architecture

```
GitHub Pages (static hosting)
    │
    ├── index.html          → Redirects to demo/timeline.html
    │
    └── demo/
        ├── timeline.html   → Pre-rendered Timeline view
        ├── analytics.html  → Pre-rendered Analytics view
        ├── day.html        → Pre-rendered Day view
        │
        ├── api/            → Mock JSON endpoints
        │   ├── calendar-2026-01.json
        │   ├── sessions-2026-01-05.json
        │   ├── summaries-2026-01-05.json
        │   ├── day-summary-2026-01-05.json
        │   └── analytics-30d.json
        │
        ├── static/
        │   ├── styles/     → Copy of production CSS
        │   ├── js/         → Modified JS with demo mode
        │   └── screenshots/→ Placeholder/sample images
        │
        └── images/         → UI assets
```

## Implementation Approach

### 1. Demo Mode Detection

Add a demo mode flag that the JS code checks:

```javascript
// At top of each JS file
const DEMO_MODE = window.location.hostname.includes('github.io')
                || window.location.pathname.includes('/demo/');

// Replace API calls
async function fetchAPI(endpoint) {
    if (DEMO_MODE) {
        // Map API endpoints to static JSON files
        const demoEndpoints = {
            '/api/calendar/2026/01': '/demo/api/calendar-2026-01.json',
            '/api/sessions/2026-01-05': '/demo/api/sessions-2026-01-05.json',
            // ... etc
        };
        const demoUrl = demoEndpoints[endpoint] || endpoint;
        return fetch(demoUrl).then(r => r.json());
    }
    return fetch(endpoint).then(r => r.json());
}
```

### 2. Mock Data Requirements

#### Calendar Data (30 days)
```json
{
  "year": 2026,
  "month": 1,
  "days": [
    {"date": "2026-01-01", "screenshot_count": 714, "active_hours": 19},
    {"date": "2026-01-02", "screenshot_count": 822, "active_hours": 20},
    // ... more days with realistic patterns
  ]
}
```

#### Sessions Data (per day)
```json
{
  "date": "2026-01-05",
  "sessions": [
    {
      "id": 1,
      "start_time": "2026-01-05T09:51:00",
      "end_time": "2026-01-05T10:27:00",
      "duration_seconds": 2160,
      "summary": "Worked on frontend dashboard improvements...",
      "confidence": 90,
      "tags": ["coding", "frontend", "dashboard"]
    }
    // ... more sessions
  ],
  "total_active_minutes": 480,
  "session_count": 8
}
```

#### Screenshots
- Use blurred/anonymized sample screenshots
- Or generate placeholder images with text overlays
- Store as WebP thumbnails (~200px wide) for fast loading

### 3. Disabled Features

In demo mode, disable features that require a backend:

- **Generate Summary** button → Show tooltip: "Disabled in demo"
- **Settings save** → Show toast: "Settings are read-only in demo mode"
- **Report generation** → Pre-generate sample reports as static HTML
- **Real-time updates** → Disable polling/WebSocket connections

### 4. Demo Banner

Add a subtle banner at the top of demo pages:

```html
<div class="demo-banner">
    <span>Demo Mode</span> -
    <a href="https://github.com/username/activity-tracker">View on GitHub</a> |
    <a href="#installation">Install locally</a>
</div>
```

### 5. Sample Data Guidelines

Create realistic but obviously fake data:

- **Dates**: Use January 2026 (clearly future)
- **Apps**: Generic names like "Code Editor", "Web Browser", "Terminal"
- **Summaries**: Professional work scenarios (coding, meetings, research)
- **Tags**: Common categories (development, communication, research)
- **Times**: Typical work hours (9 AM - 6 PM) with breaks

### 6. File Generation Script

Create a script to generate demo files from real data (anonymized):

```bash
#!/bin/bash
# scripts/generate_demo.py

# 1. Export calendar data for demo month
# 2. Anonymize session summaries
# 3. Generate placeholder screenshots
# 4. Copy and modify JS files for demo mode
# 5. Pre-render HTML templates with sample data
```

## GitHub Pages Setup

### Option A: /docs folder (Recommended)
1. Create demo files in `/docs` directory
2. Enable GitHub Pages in repo settings → Source: `/docs`
3. Demo accessible at: `https://username.github.io/activity-tracker/`

### Option B: gh-pages branch
1. Create orphan `gh-pages` branch
2. Push demo files to this branch
3. Enable GitHub Pages → Source: `gh-pages` branch

## Implementation Phases

### Phase 1: Core Demo (MVP)
- [ ] Timeline view with mock data
- [ ] Static JSON endpoints for calendar and sessions
- [ ] Demo mode detection in JS
- [ ] Basic placeholder screenshots
- [ ] Demo banner

### Phase 2: Full Demo
- [ ] Analytics view with mock charts
- [ ] Day view with screenshot gallery
- [ ] Pre-rendered sample reports
- [ ] Polished sample screenshots

### Phase 3: Polish
- [ ] Generate script for updating demo data
- [ ] Mobile-responsive demo
- [ ] Quick tour/onboarding overlay
- [ ] Link demo from main README

## Maintenance Considerations

1. **Sync with main app**: Demo may drift from actual app as features change
2. **Regenerate periodically**: Update demo data when UI changes significantly
3. **Version indicator**: Show demo version to avoid confusion
4. **Fallback**: If demo breaks, redirect to README with screenshots

## Alternative: Lightweight Backend

If static demo proves too limiting, consider:

- **Render.com free tier**: Host actual Flask app with SQLite
- **Vercel/Netlify serverless**: Flask via serverless functions
- **Railway.app**: Free tier with sleep on inactivity

Trade-offs:
- (+) Full functionality
- (+) Always in sync with main app
- (-) Cold start latency (10-30s)
- (-) Potential maintenance burden
- (-) May hit free tier limits
