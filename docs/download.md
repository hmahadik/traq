---
layout: page
---

<style scoped>
/* Hero Section */
.download-hero {
  text-align: center;
  padding: 4rem 2rem 2rem;
  max-width: 1100px;
  margin: 0 auto;
}

.download-hero h1 {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--vp-c-brand-1) 0%, var(--vp-c-brand-2) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.download-hero-tagline {
  font-size: 1.5rem;
  color: var(--vp-c-text-2);
  margin-bottom: 3rem;
  font-weight: 400;
}

/* Platform Auto-Detection Notice */
.platform-detected {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--vp-c-brand-soft);
  border-radius: 20px;
  font-size: 0.875rem;
  color: var(--vp-c-brand-1);
  margin-bottom: 2rem;
  font-weight: 500;
}

/* Primary Download Button */
.primary-download {
  margin: 0 auto 2rem;
  max-width: 500px;
}

.primary-download-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  padding: 1.5rem 2rem;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.125rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.primary-download-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  background: var(--vp-c-brand-2);
}

.primary-download-icon {
  font-size: 1.5rem;
}

/* Other Platforms */
.other-platforms {
  text-align: center;
  margin-bottom: 3rem;
}

.other-platforms-text {
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  margin-bottom: 1rem;
}

.other-platforms-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.platform-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
  transition: all 0.2s;
}

.platform-link:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  transform: translateY(-1px);
}

.platform-link-icon {
  font-size: 1.25rem;
}

/* Version Info */
.version-info {
  text-align: center;
  margin: 2rem auto 3rem;
  padding: 1rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  max-width: 500px;
}

.version-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-right: 0.5rem;
}

.version-info a {
  color: var(--vp-c-text-2);
  text-decoration: none;
  font-size: 0.875rem;
}

.version-info a:hover {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}

/* App Screenshot - Hero Style */
.app-preview {
  max-width: 1200px;
  margin: 0 auto 5rem;
  position: relative;
}

.app-screenshot {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--vp-c-border);
}

.app-screenshot img {
  width: 100%;
  height: auto;
  display: block;
}

/* Features Grid */
.features-section {
  max-width: 1100px;
  margin: 5rem auto;
  padding: 0 2rem;
}

.features-section h2 {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  transition: all 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: var(--vp-c-brand-1);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  display: block;
}

.feature-card h3 {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.feature-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

/* System Requirements */
.system-requirements {
  max-width: 900px;
  margin: 5rem auto;
  padding: 3rem 2rem;
  background: var(--vp-c-bg-soft);
  border-radius: 16px;
}

.system-requirements h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 2rem;
  text-align: center;
}

.requirements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.requirement-item h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.requirement-item ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.requirement-item li {
  padding: 0.5rem 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.requirement-item li::before {
  content: "✓";
  color: var(--vp-c-brand-1);
  font-weight: bold;
}

/* Build from Source */
.build-from-source {
  max-width: 900px;
  margin: 5rem auto;
  padding: 3rem 2rem;
  text-align: center;
  border: 2px dashed var(--vp-c-border);
  border-radius: 16px;
}

.build-from-source h2 {
  font-size: 1.75rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.build-from-source p {
  color: var(--vp-c-text-2);
  margin-bottom: 2rem;
  font-size: 1.125rem;
}

.build-from-source a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: var(--vp-c-bg);
  border: 2px solid var(--vp-c-brand-1);
  border-radius: 10px;
  text-decoration: none;
  color: var(--vp-c-brand-1);
  font-weight: 600;
  transition: all 0.2s;
}

.build-from-source a:hover {
  background: var(--vp-c-brand-1);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .download-hero h1 {
    font-size: 2.5rem;
  }

  .download-hero-tagline {
    font-size: 1.25rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .requirements-grid {
    grid-template-columns: 1fr;
  }

  .other-platforms-links {
    flex-direction: column;
    align-items: center;
  }

  .platform-link {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }
}
</style>

<div class="download-hero">
  <h1>Download Traq</h1>
  <p class="download-hero-tagline">Your work, automatically documented</p>

  <div class="platform-detected">
    <span>🎯</span>
    <span>Automatic platform detection</span>
  </div>

  <div class="primary-download">
    <a href="https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-linux-amd64" class="primary-download-button" download>
      <span class="primary-download-icon">🐧</span>
      <span>Download for Linux</span>
    </a>
  </div>

  <div class="other-platforms">
    <p class="other-platforms-text">Other platforms:</p>
    <div class="other-platforms-links">
      <a href="https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-macos-universal.zip" class="platform-link" download>
        <span class="platform-link-icon">🍎</span>
        <span>macOS</span>
      </a>
      <a href="https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-windows-amd64.exe" class="platform-link" download>
        <span class="platform-link-icon">🪟</span>
        <span>Windows</span>
      </a>
    </div>
  </div>

  <div class="version-info">
    <span class="version-badge">Latest Release</span>
    <a href="https://github.com/hmahadik/activity-tracker/releases/latest" target="_blank">View all release notes →</a>
  </div>
</div>

<div class="app-preview">
  <div class="app-screenshot">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="/screenshots/timeline-dark.png">
      <img src="/screenshots/timeline.png" alt="Traq Timeline View - Hour-by-hour activity tracking with screenshots and AI summaries">
    </picture>
  </div>
</div>

<div class="features-section">
  <h2>What's Included</h2>
  <div class="features-grid">
    <div class="feature-card">
      <span class="feature-icon">📸</span>
      <h3>Automatic Screenshots</h3>
      <p>Captures your screen at configurable intervals. All images stored locally and encrypted.</p>
    </div>

    <div class="feature-card">
      <span class="feature-icon">📊</span>
      <h3>Analytics Dashboard</h3>
      <p>Visualize your productivity patterns with charts, heatmaps, and time breakdowns.</p>
    </div>

    <div class="feature-card">
      <span class="feature-icon">🤖</span>
      <h3>AI Summaries</h3>
      <p>Generate intelligent summaries of your work sessions using your own API keys.</p>
    </div>

    <div class="feature-card">
      <span class="feature-icon">🔒</span>
      <h3>100% Private</h3>
      <p>All data stays on your machine. No cloud sync, no accounts, no tracking.</p>
    </div>

    <div class="feature-card">
      <span class="feature-icon">📝</span>
      <h3>Report Generation</h3>
      <p>Create daily, weekly, or custom reports in HTML, Markdown, or JSON format.</p>
    </div>

    <div class="feature-card">
      <span class="feature-icon">⚡</span>
      <h3>Lightweight</h3>
      <p>Single binary with minimal dependencies. Low CPU and memory footprint.</p>
    </div>
  </div>
</div>

<div class="system-requirements">
  <h2>System Requirements</h2>
  <div class="requirements-grid">
    <div class="requirement-item">
      <h3>🐧 Linux</h3>
      <ul>
        <li>64-bit processor</li>
        <li>xdotool for window tracking</li>
        <li>GTK 3.0+ and WebKit2GTK</li>
        <li>~100MB disk space</li>
      </ul>
    </div>

    <div class="requirement-item">
      <h3>🍎 macOS</h3>
      <ul>
        <li>macOS 10.15 or later</li>
        <li>Apple Silicon or Intel</li>
        <li>Screen Recording permission</li>
        <li>~100MB disk space</li>
      </ul>
    </div>

    <div class="requirement-item">
      <h3>🪟 Windows</h3>
      <ul>
        <li>Windows 10 or later</li>
        <li>64-bit processor</li>
        <li>WebView2 runtime</li>
        <li>~100MB disk space</li>
      </ul>
    </div>
  </div>
</div>

<div class="build-from-source">
  <h2>Build from Source</h2>
  <p>Want to compile it yourself or contribute to development?</p>
  <a href="/guide/getting-started#build-from-source">
    <span>📦</span>
    <span>View Build Instructions</span>
  </a>
</div>

<script setup>
// Auto-detect platform and update download button
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const primaryButton = document.querySelector('.primary-download-button');
    const platformDetected = document.querySelector('.platform-detected');

    if (!primaryButton) return;

    let platform = 'linux';
    let platformName = 'Linux';
    let platformIcon = '🐧';
    let downloadUrl = 'https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-linux-amd64';

    if (userAgent.includes('mac')) {
      platform = 'macos';
      platformName = 'macOS';
      platformIcon = '🍎';
      downloadUrl = 'https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-macos-universal.zip';
    } else if (userAgent.includes('win')) {
      platform = 'windows';
      platformName = 'Windows';
      platformIcon = '🪟';
      downloadUrl = 'https://github.com/hmahadik/activity-tracker/releases/latest/download/traq-windows-amd64.exe';
    }

    primaryButton.href = downloadUrl;
    primaryButton.innerHTML = `
      <span class="primary-download-icon">${platformIcon}</span>
      <span>Download for ${platformName}</span>
    `;

    if (platformDetected) {
      platformDetected.innerHTML = `
        <span>🎯</span>
        <span>We detected you're on ${platformName}</span>
      `;
    }
  });
}
</script>
