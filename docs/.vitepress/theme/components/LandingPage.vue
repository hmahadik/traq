<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { withBase } from 'vitepress'
import AnimatedBackground from './AnimatedBackground.vue'
import AppPreview from './AppPreview.vue'

const taglines = [
  { top: 'Your Work,', bottom: '', highlight: 'Automatically Documented' },
  { top: 'Know Where', bottom: 'Your ', highlight: 'Time Goes' },
  { top: 'Every Session,', bottom: '', highlight: 'Perfectly Recalled' },
  { top: 'Your Standup Report', bottom: '', highlight: 'Writes Itself' },
  { top: 'Never Wonder', bottom: 'What You Did ', highlight: 'Yesterday' },
  { top: 'From First Commit to', bottom: 'Final Push, ', highlight: 'Tracked' },
]

const tagline = taglines[Math.floor(Math.random() * taglines.length)]

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    },
    { threshold: 0.1 }
  )
  document.querySelectorAll('.fade-in').forEach((el) => {
    observer!.observe(el)
  })
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="landing-page">
    <AnimatedBackground />

    <!-- Nav -->
    <nav class="landing-nav">
      <a href="#" class="nav-logo">Traq</a>
      <ul class="nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#how-it-works">How It Works</a></li>
        <li><a href="https://github.com/hmahadik/traq" target="_blank" rel="noopener">GitHub</a></li>
        <li><a :href="withBase('/guide/getting-started')">Docs</a></li>
      </ul>
      <a :href="withBase('/download')" class="nav-cta">Download</a>
    </nav>

    <!-- Hero -->
    <section class="landing-hero">
      <div class="hero-badge hero-anim">
        <span class="badge-dot"></span>
        v2.0 &mdash; Now with Git Tracking &amp; AI Summaries
      </div>
      <h1 class="hero-title hero-anim" style="animation-delay: 0.2s">
        {{ tagline.top }}<br />
        {{ tagline.bottom }}<span class="gradient-text">{{ tagline.highlight }}</span>
      </h1>
      <p class="hero-subtitle hero-anim" style="animation-delay: 0.4s">
        A privacy-first desktop app that captures screenshots, tracks window focus,
        logs developer activity, and generates reports &mdash; all locally.
      </p>
      <div class="hero-actions hero-anim" style="animation-delay: 0.6s">
        <a :href="withBase('/download')" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </a>
        <a href="https://github.com/hmahadik/traq" class="btn-secondary" target="_blank" rel="noopener">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          View on GitHub
        </a>
      </div>

      <div class="hero-visual hero-anim" style="animation-delay: 0.8s">
        <AppPreview />
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="landing-features">
      <div class="section-header">
        <div class="section-tag">Features</div>
        <h2>Everything You Need to Track Your Day</h2>
        <p>Traq captures your work context automatically so you can focus on what matters.</p>
      </div>

      <div class="features-grid">
        <div class="feature-card fade-in">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <h3>Automatic Screenshots</h3>
          <p>Captures your screen at configurable intervals with dHash deduplication to skip near-identical frames and save disk space.</p>
        </div>

        <div class="feature-card fade-in">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <h3>Window &amp; App Tracking</h3>
          <p>Recognizes 150+ applications by name, records window titles and focus time with category-based grouping.</p>
        </div>

        <div class="feature-card fade-in">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </div>
          <h3>Developer Activity</h3>
          <p>Automatically captures git commits, shell commands, browser history, and file events &mdash; no manual logging needed.</p>
        </div>

        <div class="feature-card fade-in">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3>Timeline Visualization</h3>
          <p>Hour-by-hour grid view with app blocks, screenshots, git commits, shell commands, and AI-powered session summaries.</p>
        </div>

        <div class="feature-card fade-in">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <h3>Analytics Dashboard</h3>
          <p>App usage pie charts, hourly activity heatmaps, category breakdowns, and CSV export for deeper analysis.</p>
        </div>

        <div class="feature-card fade-in">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <h3>Report Generation</h3>
          <p>Generate Summary, Detailed, or Standup reports. Export as HTML, Markdown, or JSON for timesheets and standups.</p>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section id="how-it-works" class="landing-how-it-works">
      <div class="section-header">
        <div class="section-tag">How It Works</div>
        <h2>Up and Running in Minutes</h2>
        <p>No configuration required. Install it, launch it, and it just works.</p>
      </div>

      <div class="steps">
        <div class="step fade-in">
          <div class="step-number">1</div>
          <h3>Install &amp; Launch</h3>
          <p>Download the binary for your platform. No accounts, no signup, no cloud dependencies.</p>
        </div>

        <div class="step fade-in">
          <div class="step-number">2</div>
          <h3>Work Normally</h3>
          <p>Traq runs silently in the background, capturing screenshots and tracking your active applications.</p>
        </div>

        <div class="step fade-in">
          <div class="step-number">3</div>
          <h3>Review &amp; Report</h3>
          <p>Browse your timeline, check analytics, and generate reports whenever you need them.</p>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="landing-stats fade-in">
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">100%</div>
          <div class="stat-label">Local &amp; Private</div>
        </div>
        <div class="stat">
          <div class="stat-value">&lt;1%</div>
          <div class="stat-label">CPU Usage</div>
        </div>
        <div class="stat">
          <div class="stat-value">150+</div>
          <div class="stat-label">Apps Recognized</div>
        </div>
        <div class="stat">
          <div class="stat-value">&infin;</div>
          <div class="stat-label">Data Retention</div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="landing-cta fade-in">
      <h2>Ready to <span class="gradient-text">Traq</span> Your Time?</h2>
      <p>Start documenting your work automatically. Free, open source, and completely private.</p>
      <div class="cta-actions">
        <a :href="withBase('/download')" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </a>
        <a href="https://github.com/hmahadik/traq" class="btn-secondary" target="_blank" rel="noopener">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          View on GitHub
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="footer-logo">Traq</div>
      <div class="footer-links">
        <a :href="withBase('/guide/getting-started')">Documentation</a>
        <a :href="withBase('/download')">Download</a>
        <a href="https://github.com/hmahadik/traq" target="_blank" rel="noopener">GitHub</a>
        <a href="https://github.com/hmahadik/traq/issues" target="_blank" rel="noopener">Issues</a>
      </div>
      <div class="footer-copyright">&copy; 2025 Traq. Open source under MIT License.</div>
    </footer>
  </div>
</template>
