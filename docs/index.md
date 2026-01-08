---
layout: home

hero:
  name: Traq
  text: Activity Tracker
  tagline: Automatic screenshots, window tracking, and productivity analytics for your desktop
  image:
    light: /screenshots/timeline.png
    dark: /screenshots/timeline-dark.png
    alt: Traq Timeline View
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Download
      link: /download

features:
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
    title: Timeline View
    details: Interactive calendar heatmap with session breakdown to review your day.
    link: '#timeline'
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
    title: Analytics Dashboard
    details: Visualize your activity patterns with charts showing app usage and productivity trends.
    link: '#analytics'
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    title: Report Generation
    details: Generate reports with natural language time ranges and export in multiple formats.
    link: '#reports'
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
    title: Automatic Screenshots
    details: Captures screenshots at configurable intervals with smart duplicate detection to save space.
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
    title: Window Tracking
    details: Records active window titles and application names to understand where you spend your time.
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
    title: Cross-Platform
    details: Native desktop app for Linux, macOS, and Windows via Wails.
---

<style>
.feature-section {
  max-width: 1152px;
  margin: 0 auto;
  padding: 64px 24px;
}

.feature-section h2 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.feature-section p {
  color: var(--vp-c-text-2);
  margin-bottom: 1.5rem;
  max-width: 640px;
}

.feature-section picture {
  display: block;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.feature-section img {
  width: 100%;
  height: auto;
  display: block;
}

.dark .feature-section picture {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}
</style>

<div class="feature-section" id="timeline">

## Timeline View

Review your day with an interactive timeline. Each session shows when you were active, which applications you used, and AI-generated summaries of what you accomplished. Click any session to see detailed screenshots and activity logs.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/timeline-dark.png">
  <img src="/screenshots/timeline.png" alt="Timeline View showing daily sessions">
</picture>

</div>

<div class="feature-section" id="analytics">

## Analytics Dashboard

Understand your productivity patterns with visual analytics. See how you spend time across applications, identify your most productive hours, and track trends over days, weeks, or months.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/analytics-dark.png">
  <img src="/screenshots/analytics.png" alt="Analytics Dashboard with charts and graphs">
</picture>

</div>

<div class="feature-section" id="reports">

## Report Generation

Generate activity reports using natural language time ranges like "last week" or "yesterday afternoon." Export reports in multiple formats for sharing with your team or keeping personal records.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/screenshots/reports-dark.png">
  <img src="/screenshots/reports.png" alt="Report Generation interface">
</picture>

</div>
