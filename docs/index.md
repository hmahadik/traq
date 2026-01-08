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
---

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'

const { isDark } = useData()
const expandedSection = ref(null)

function toggleExpand(sectionId) {
  if (expandedSection.value === sectionId) {
    expandedSection.value = null
    document.body.style.overflow = ''
  } else {
    expandedSection.value = sectionId
    document.body.style.overflow = 'hidden'
  }
}

function closeExpanded() {
  expandedSection.value = null
  document.body.style.overflow = ''
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    closeExpanded()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<div class="feature-section" :class="{ expanded: expandedSection === 'timeline' }" id="timeline" @click="toggleExpand('timeline')">
  <div v-if="expandedSection === 'timeline'" class="modal-backdrop" @click.stop="closeExpanded"></div>
  <button v-if="expandedSection === 'timeline'" class="close-btn" @click.stop="closeExpanded">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <div class="section-content">
    <h2>Timeline View</h2>
    <p>Review your day with an interactive timeline. Each session shows when you were active, which applications you used, and AI-generated summaries of what you accomplished. Click any session to see detailed screenshots and activity logs.</p>
    <div class="screenshot-container">
      <img v-if="isDark" src="/screenshots/timeline-dark.png" alt="Timeline View showing daily sessions" />
      <img v-else src="/screenshots/timeline.png" alt="Timeline View showing daily sessions" />
    </div>
  </div>
</div>

<div class="feature-section" :class="{ expanded: expandedSection === 'session-details' }" id="session-details" @click="toggleExpand('session-details')">
  <div v-if="expandedSection === 'session-details'" class="modal-backdrop" @click.stop="closeExpanded"></div>
  <button v-if="expandedSection === 'session-details'" class="close-btn" @click.stop="closeExpanded">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <div class="section-content">
    <h2>Session Details</h2>
    <p>Dive deep into any work session. Browse through captured screenshots with an interactive gallery, see which applications were active, and review AI-generated summaries of your accomplishments.</p>
    <div class="screenshot-container">
      <img v-if="isDark" src="/screenshots/session-details-dark.png" alt="Session Details with screenshot gallery" />
      <img v-else src="/screenshots/session-details.png" alt="Session Details with screenshot gallery" />
    </div>
  </div>
</div>

<div class="feature-section" :class="{ expanded: expandedSection === 'analytics' }" id="analytics" @click="toggleExpand('analytics')">
  <div v-if="expandedSection === 'analytics'" class="modal-backdrop" @click.stop="closeExpanded"></div>
  <button v-if="expandedSection === 'analytics'" class="close-btn" @click.stop="closeExpanded">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <div class="section-content">
    <h2>Analytics Dashboard</h2>
    <p>Understand your productivity patterns with visual analytics. See how you spend time across applications, identify your most productive hours, and track trends over days, weeks, or months.</p>
    <div class="screenshot-container">
      <img v-if="isDark" src="/screenshots/analytics-dark.png" alt="Analytics Dashboard with charts and graphs" />
      <img v-else src="/screenshots/analytics.png" alt="Analytics Dashboard with charts and graphs" />
    </div>
  </div>
</div>

<div class="feature-section" :class="{ expanded: expandedSection === 'reports' }" id="reports" @click="toggleExpand('reports')">
  <div v-if="expandedSection === 'reports'" class="modal-backdrop" @click.stop="closeExpanded"></div>
  <button v-if="expandedSection === 'reports'" class="close-btn" @click.stop="closeExpanded">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <div class="section-content">
    <h2>Report Generation</h2>
    <p>Generate activity reports using natural language time ranges like "last week" or "yesterday afternoon." Export reports in multiple formats for sharing with your team or keeping personal records.</p>
    <div class="screenshot-container">
      <img v-if="isDark" src="/screenshots/reports-dark.png" alt="Report Generation interface" />
      <img v-else src="/screenshots/reports.png" alt="Report Generation interface" />
    </div>
  </div>
</div>

<div class="feature-section" :class="{ expanded: expandedSection === 'settings' }" id="settings" @click="toggleExpand('settings')">
  <div v-if="expandedSection === 'settings'" class="modal-backdrop" @click.stop="closeExpanded"></div>
  <button v-if="expandedSection === 'settings'" class="close-btn" @click.stop="closeExpanded">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <div class="section-content">
    <h2>Customizable Settings</h2>
    <p>Fine-tune Traq to match your workflow. Configure screenshot intervals, set activity goals, manage git repository tracking, define file watch directories, and customize which applications are tracked.</p>
    <div class="screenshot-container">
      <img v-if="isDark" src="/screenshots/settings-dark.png" alt="Settings and configuration options" />
      <img v-else src="/screenshots/settings.png" alt="Settings and configuration options" />
    </div>
  </div>
</div>

<style>
/* Hero section styling */
.VPHero {
  min-height: 100vh;
  padding: 48px 24px 80px;
  position: relative;
}

.VPHero .container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 1152px;
  margin: 0 auto;
  gap: 48px;
}

.VPHero .main {
  text-align: center;
  max-width: 700px;
  order: 1;
}

.VPHero .actions {
  justify-content: center;
}

.VPHero .image {
  order: 2;
  width: 100%;
  max-width: 1000px;
  margin: 32px 0 0 0;
  padding: 0;
}

.VPHero .image-container {
  width: 100%;
  max-width: none;
  transform: none;
}

.VPHero .image-bg {
  display: none;
}

.VPHero .VPImage {
  position: static;
  transform: none;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
}

.dark .VPHero .VPImage {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* Feature sections */
.feature-section {
  max-width: 1152px;
  margin: 0 auto;
  padding: 64px 24px;
  cursor: pointer;
  transition: background 0.3s ease, border-radius 0.3s ease;
  position: relative;
}

.feature-section:hover {
  background: var(--vp-c-bg-soft);
  border-radius: 16px;
}

.section-content {
  position: relative;
  z-index: 2;
}

.feature-section h2 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-section:not(.expanded) h2::after {
  content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='15 3 21 3 21 9'/%3E%3Cpolyline points='9 21 3 21 3 15'/%3E%3Cline x1='21' y1='3' x2='14' y2='10'/%3E%3Cline x1='3' y1='21' x2='10' y2='14'/%3E%3C/svg%3E");
  opacity: 0;
  transition: opacity 0.2s ease;
}

.feature-section:hover:not(.expanded) h2::after {
  opacity: 0.6;
}

.feature-section p {
  color: var(--vp-c-text-2);
  margin-bottom: 1.5rem;
  max-width: 640px;
}

.screenshot-container {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-section:hover:not(.expanded) .screenshot-container {
  transform: scale(1.01);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
}

.screenshot-container img {
  width: 100%;
  height: auto;
  display: block;
}

.dark .screenshot-container {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.dark .feature-section:hover:not(.expanded) .screenshot-container {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

/* Modal backdrop */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 99;
}

.dark .modal-backdrop {
  background: rgba(0, 0, 0, 0.75);
}

/* Expanded/fullscreen feature section */
.feature-section.expanded {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: none;
  margin: 0;
  padding: 24px;
  background: var(--vp-c-bg);
  z-index: 100;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  cursor: default;
  border-radius: 0;
}

.feature-section.expanded:hover {
  background: var(--vp-c-bg);
  border-radius: 0;
}

.feature-section.expanded .section-content {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.feature-section.expanded h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.feature-section.expanded h2::after {
  display: none;
}

.feature-section.expanded p {
  font-size: 1.1rem;
  max-width: 800px;
}

.feature-section.expanded .screenshot-container {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}

.feature-section.expanded .screenshot-container img {
  max-height: calc(100vh - 180px);
  width: auto;
  max-width: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.dark .feature-section.expanded .screenshot-container img {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

.feature-section.expanded:hover .screenshot-container {
  transform: none;
}

/* Close button */
.close-btn {
  position: fixed;
  top: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--vp-c-text-2);
  transition: all 0.2s ease;
  z-index: 101;
}

.close-btn:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  transform: scale(1.05);
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .feature-section {
    padding: 48px 16px;
  }

  .feature-section h2 {
    font-size: 1.5rem;
  }

  .feature-section.expanded {
    padding: 16px;
  }

  .feature-section.expanded h2 {
    font-size: 1.75rem;
  }

  .feature-section.expanded .screenshot-container img {
    max-height: calc(100vh - 160px);
  }

  .close-btn {
    top: 16px;
    right: 16px;
  }
}
</style>
