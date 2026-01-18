# Settings UI Redesign

## Overview

Replace the current modal-based Settings UI with a dedicated settings page featuring a sidebar navigation pattern. The goal is to reduce visual density, improve discoverability, and create a clean, modern aesthetic similar to Linear/Notion settings.

## Current State

- Settings is a modal dialog (`SettingsDrawer.tsx`, ~1070 lines)
- 6 horizontal tabs: Capture, AI, Categories, Timeline Categories, Sources, System
- Dense layout with nested boxes and cramped spacing
- Tabs wrap awkwardly on smaller screens
- Modal approach loses context of what user was doing

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page vs Modal | Dedicated page at `/settings` | More room, better organization, no context loss |
| Visual style | Clean & minimal (Linear/Notion) | Lots of whitespace, simple cards, muted colors |
| Layout | Left-aligned content, max-w-2xl | Avoids awkward centering on 4K displays |
| Navigation | Fixed sidebar with 5 sections | Consolidates 6 tabs into 5 logical groups |

## Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│              │                                              │
│  [Icon] Capture     │  Section Title                        │
│  [Icon] Data Sources│  ────────────────────────────         │
│  [Icon] AI          │                                       │
│  [Icon] Categories  │  ┌─────────────────────────────────┐  │
│  [Icon] General     │  │  Card Title                     │  │
│              │  │                                 │  │
│              │  │  Setting label          [ctrl] │  │
│              │  │  Description text              │  │
│              │  │                                 │  │
│              │  └─────────────────────────────────┘  │
│              │                                       │
│              │  ┌─────────────────────────────────┐  │
│  ───────────────│  │  Another Card                   │  │
│  v1.2.3      │  │  ...                            │  │
│              │  └─────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
     ~200px                    flex-1, max-w-2xl
```

- **Sidebar**: Fixed width (~200px), section names with icons, version at bottom
- **Content**: Scrollable, left-aligned, max-width 640px (2xl), generous padding
- **Cards**: Grouped settings with subtle border, rounded-lg, p-6, 24px gap between

## Section Consolidation (6 → 5)

| New Section | Contains | Cards |
|-------------|----------|-------|
| **Capture** | Screenshot settings, monitor selection, AFK | 3 cards |
| **Data Sources** | Shell, Git, Files, Browser tracking | 4 cards (collapsible) |
| **AI** | Inference engine, model management | 2 cards |
| **Categories** | App categories, Timeline categories | 2 cards |
| **General** | Appearance, Behavior, Storage, Privacy | 4 cards |

## Section Details

### 1. Capture

**Card: Screenshot Capture**
- Enable capture toggle
- Capture interval slider (10s - 120s)
- Image quality segmented control (Low/Medium/High) + fine-tune slider
- Duplicate threshold slider

**Card: Monitor Selection**
- Monitor mode dropdown (Follow Active Window / Primary / Specific)
- Specific monitor picker (conditional, only when "Specific" selected)
- Detected monitors count

**Card: AFK Detection**
- AFK timeout slider (1-10 minutes)
- Min session duration slider

### 2. Data Sources

Each card follows the pattern: enable toggle in header, settings revealed when enabled.

**Card: Shell History**
- Enable toggle
- Shell type selector (Auto/Bash/Zsh/Fish/PowerShell)
- Custom history path input
- Exclude patterns textarea

**Card: Git Activity**
- Enable toggle
- Repository list management (reuse GitRepositoriesSection)

**Card: File Changes**
- Enable toggle
- Watch directories (reuse FileWatchDirectoriesSection)
- Extension filter (reuse FileExtensionFilterSection)
- Exclude patterns textarea

**Card: Browser History**
- Enable toggle
- Browser checkboxes (Chrome, Firefox, Brave, Edge, Safari)
- History limit dropdown
- Excluded domains textarea

### 3. AI

**Card: Inference Engine**
- Engine selector (Bundled/Ollama/Cloud)
- Conditional content based on selection:
  - **Bundled**: Shows server status + model selector
  - **Ollama**: Host input, model input, test connection button
  - **Cloud**: Provider selector, API key input, custom endpoint input

**Card: Model Management** (only when Bundled selected)
- Server install status/button
- Download progress (when active)
- Available models list with download buttons
- Current inference status

### 4. Categories

**Card: App Categories**
- Reuse existing `CategoriesTab` component
- Stats grid (productive/neutral/distracting/uncategorized counts)
- Search input
- Scrollable app list with category dropdowns

**Card: Timeline Categories**
- Reuse existing `TimelineCategoriesTab` component

### 5. General

**Card: Appearance**
- Theme selector (System/Light/Dark)

**Card: Behavior**
- Start on login toggle
- Show notifications toggle

**Card: Storage**
- Storage stats (Database size, Screenshots size, Total)
- Data directory path display
- Open Data Directory button
- Optimize Database button

**Card: Privacy & Data**
- Crash reporting toggle with explanation
- Export Data button
- Clear All Data button (destructive)
- Version info and release notes link

## Visual Specifications

### Cards
```css
.settings-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg); /* rounded-lg */
  padding: 1.5rem; /* p-6 */
}

.settings-card + .settings-card {
  margin-top: 1.5rem; /* 24px gap */
}
```

### Card Header
```css
.card-title {
  font-size: 1rem; /* text-base */
  font-weight: 500; /* font-medium */
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
```

### Setting Row
```css
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
}

.setting-label {
  font-size: 0.875rem; /* text-sm */
}

.setting-description {
  font-size: 0.875rem;
  color: var(--muted-foreground);
}
```

### Collapsible Data Source Cards
When disabled, card shows only:
- Card title with icon
- Enable toggle on the right
- No border-bottom on title, minimal height

When enabled, full content is revealed with smooth height transition.

## File Structure

```
frontend/src/
├── pages/
│   └── SettingsPage.tsx              # Main layout + section routing
├── components/settings/
│   ├── SettingsSidebar.tsx           # Left navigation
│   ├── SettingsCard.tsx              # Reusable card wrapper
│   ├── SettingsRow.tsx               # Label + control row layout
│   ├── sections/
│   │   ├── CaptureSettings.tsx
│   │   ├── DataSourcesSettings.tsx
│   │   ├── AISettings.tsx
│   │   ├── CategoriesSettings.tsx
│   │   └── GeneralSettings.tsx
│   ├── CategoriesTab.tsx             # Existing, reused
│   ├── TimelineCategoriesTab.tsx     # Existing, reused
│   ├── GitRepositoriesSection.tsx    # Existing, reused
│   ├── FileWatchDirectoriesSection.tsx # Existing, reused
│   └── FileExtensionFilterSection.tsx  # Existing, reused
```

## Routing

```tsx
// In App.tsx or router config
<Route path="/settings" element={<SettingsPage />}>
  <Route index element={<Navigate to="/settings/capture" replace />} />
  <Route path="capture" element={<CaptureSettings />} />
  <Route path="data-sources" element={<DataSourcesSettings />} />
  <Route path="ai" element={<AISettings />} />
  <Route path="categories" element={<CategoriesSettings />} />
  <Route path="general" element={<GeneralSettings />} />
</Route>
```

Deep-linking allows direct navigation to specific sections (e.g., `/settings/ai`).

## Migration Plan

1. **Create infrastructure**
   - Add `SettingsCard` and `SettingsRow` components
   - Add `SettingsSidebar` component
   - Create new `SettingsPage.tsx` with layout

2. **Extract sections**
   - Create each section component, extracting logic from `SettingsDrawer.tsx`
   - Reuse existing sub-components (`CategoriesTab`, etc.)

3. **Update navigation**
   - Add Settings to main app sidebar (if not already there)
   - Set up routes with nested section routing
   - Remove modal trigger from wherever it exists

4. **Cleanup**
   - Delete `SettingsDrawer.tsx`
   - Remove old redirect-only `SettingsPage.tsx`
   - Update any imports/references

## Out of Scope

- Settings search functionality
- Settings reset to defaults
- Settings import/export
- Keyboard navigation between sections
- Mobile/responsive layout (desktop app)
