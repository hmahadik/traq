# Plan: Fix AI Session Summaries to Work Out-of-the-Box

## Problem Statement

**Current State**: AI summary code is 100% complete but doesn't work for users because:
- Default config requires external Ollama server with specific model
- No automatic setup or download of bundled model
- Silent failures with generic error messages
- UI missing "Generate Summary" button and setup wizard

**Discovery**: Phase 1 audit revealed methodology flaw - agents verified "code exists" but not "works for users". AI summaries marked PASS but actually INCOMPLETE.

**Goal**: Make AI summaries functional on fresh install with excellent UX.

## Chosen Approach: Hybrid Prompt-on-First-Use

### User Flow

**First-Time User**:
1. Creates session with activity
2. Views session detail page
3. Sees "Generate Summary" button (even without existing summary)
4. Clicks "Generate Summary"
5. Setup dialog appears: "AI Summaries Not Configured"
   - **Option 1: Bundled Model (Recommended)** - "Works offline, ~1.5GB download"
   - **Option 2: External Ollama** - "Use your own Ollama server"
   - **Option 3: Cloud API** - "Use Anthropic/OpenAI API"
6. Selects Bundled → Progress dialog shows download (server + model)
7. After completion → Summary generates automatically
8. Future clicks → Summaries generate instantly (no dialog)

**Existing Ollama User**:
- If Ollama already configured and running → No dialog, works immediately
- If Ollama configured but not running → Clear error: "Ollama not reachable at localhost:11434"

### Why This Design?

**Advantages**:
- ✅ Non-invasive (no forced download on launch)
- ✅ Respects user choice (offline/cloud/existing setup)
- ✅ Clear value proposition before download
- ✅ Works for both new and existing users
- ✅ Progressive disclosure (only show complexity when needed)

**Addresses Concerns**:
- Download size: User explicitly consents, sees progress/ETA
- Storage: Checks disk space before download
- Network failures: Retry logic with exponential backoff
- Permissions: Detects and shows clear error messages

## Detailed Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Change Default Configuration (2 hours)

**File**: `/home/harshad/projects/traq/internal/service/config.go`

**Changes**:
- Line ~664: Change default engine from `ollama` to `bundled`
- Add default bundled config pointing to `gemma-2-2b-it-q4` (2.4GB model)
- Keep Ollama config as commented alternative for reference

**Before**:
```go
func getDefaultInferenceConfig() InferenceConfig {
    return InferenceConfig{
        Engine: "ollama",
        Ollama: &OllamaConfig{
            Host:  "http://localhost:11434",
            Model: "gemma3:12b-it-qat",
        },
    }
}
```

**After**:
```go
func getDefaultInferenceConfig() InferenceConfig {
    return InferenceConfig{
        Engine: "bundled",
        Bundled: &BundledConfig{
            ModelName: "gemma-2-2b-it-q4",
            // Model and server paths auto-determined by inference service
        },
        // Alternative: Ollama
        // Engine: "ollama",
        // Ollama: &OllamaConfig{
        //     Host:  "http://localhost:11434",
        //     Model: "gemma3:12b-it-qat",
        // },
    }
}
```

**Testing**:
- Remove config: `rm ~/.config/traq/config.db`
- Start app, verify new config created with bundled default

---

#### 1.2 Add Setup Status Detection (3 hours)

**File**: `/home/harshad/projects/traq/internal/inference/inference.go`

**New Method**: `GetSetupStatus() *SetupStatus`

**Returns structured status**:
```go
type SetupStatus struct {
    Ready      bool   `json:"ready"`
    Engine     string `json:"engine"`
    Issue      string `json:"issue,omitempty"`       // Empty if ready
    Suggestion string `json:"suggestion,omitempty"` // Actionable fix
}
```

**Logic**:
```go
func (s *Service) GetSetupStatus(ctx context.Context) (*SetupStatus, error) {
    config := s.config

    switch config.Engine {
    case EngineOllama:
        // Test connection to Ollama
        resp, err := http.Get(config.Ollama.Host + "/api/tags")
        if err != nil {
            return &SetupStatus{
                Ready:      false,
                Engine:     "ollama",
                Issue:      "Cannot reach Ollama server",
                Suggestion: "Install and start Ollama from https://ollama.com",
            }, nil
        }
        // Check if model exists
        // ... parse response, verify model in list

    case EngineBundled:
        paths := GetDefaultPaths()

        // Check if server binary exists
        if !fileExists(paths.ServerPath) {
            return &SetupStatus{
                Ready:      false,
                Engine:     "bundled",
                Issue:      "llama-server binary not found",
                Suggestion: "Download bundled AI model in Settings > AI",
            }, nil
        }

        // Check if model file exists
        modelPath := filepath.Join(paths.ModelsDir, config.Bundled.ModelName + ".gguf")
        if !fileExists(modelPath) {
            return &SetupStatus{
                Ready:      false,
                Engine:     "bundled",
                Issue:      "Model file not found",
                Suggestion: "Download bundled AI model in Settings > AI",
            }, nil
        }

        // Both exist, test if server can start
        return &SetupStatus{Ready: true, Engine: "bundled"}, nil

    case EngineCloud:
        // Check API key exists
        if config.Cloud.APIKey == "" {
            return &SetupStatus{
                Ready:      false,
                Engine:     "cloud",
                Issue:      "API key not configured",
                Suggestion: "Add API key in Settings > AI",
            }, nil
        }
        return &SetupStatus{Ready: true, Engine: "cloud"}, nil
    }
}
```

**New API Endpoint**: Add to `app.go`
```go
func (a *App) GetInferenceSetupStatus(ctx context.Context) (*inference.SetupStatus, error) {
    return a.inference.GetSetupStatus(ctx)
}
```

**Testing**:
- With no model: Verify returns `Ready: false`, correct suggestion
- With model installed: Verify returns `Ready: true`
- With Ollama not running: Verify returns helpful error

---

#### 1.3 Enhanced Error Handling (2 hours)

**File**: `/home/harshad/projects/traq/internal/service/summary.go`

**Changes**: Line ~49-52, before calling inference

**Before**:
```go
result, err := s.inference.GenerateSummary(ctx)
if err != nil {
    return nil, fmt.Errorf("failed to generate summary: %w", err)
}
```

**After**:
```go
// Check setup status first
status, err := s.inference.GetSetupStatus(ctx)
if err != nil {
    return nil, fmt.Errorf("failed to check inference status: %w", err)
}

if !status.Ready {
    return nil, fmt.Errorf("inference not ready: %s. %s", status.Issue, status.Suggestion)
}

// Now attempt generation
result, err := s.inference.GenerateSummary(ctx)
if err != nil {
    return nil, fmt.Errorf("failed to generate summary: %w", err)
}
```

**Testing**:
- With no model: Verify error includes actionable suggestion
- With Ollama not running: Verify error mentions Ollama specifically

---

#### 1.4 Disk Space Check Before Downloads (2 hours)

**File**: `/home/harshad/projects/traq/internal/inference/bundled.go`

**New Method**: Add to `BundledEngine`

```go
func (e *BundledEngine) CheckDiskSpace(requiredGB float64) error {
    paths := GetDefaultPaths()

    var stat syscall.Statfs_t
    if err := syscall.Statfs(paths.ModelsDir, &stat); err != nil {
        return fmt.Errorf("failed to check disk space: %w", err)
    }

    availableGB := float64(stat.Bavail*uint64(stat.Bsize)) / (1024 * 1024 * 1024)

    if availableGB < requiredGB {
        return fmt.Errorf("insufficient disk space: %.1fGB available, %.1fGB required",
            availableGB, requiredGB)
    }

    return nil
}
```

**Update DownloadModel()**: Call CheckDiskSpace() before starting download

**Testing**:
- Artificially fill disk, verify error caught before download
- Normal case: Verify download proceeds

---

### Phase 2: Frontend Changes

#### 2.1 Create Setup Dialog Component (5 hours)

**New File**: `/home/harshad/projects/traq/frontend/src/components/session/SummarySetupDialog.tsx`

**Component Structure**:
```tsx
export function SummarySetupDialog({
  isOpen,
  onClose,
  onComplete
}: SummarySetupDialogProps) {
  const [step, setStep] = useState<'select' | 'downloading' | 'complete'>('select')
  const [selectedEngine, setSelectedEngine] = useState<'bundled' | 'ollama' | 'cloud'>()
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>()

  // Step 1: Engine Selection
  if (step === 'select') {
    return (
      <Dialog open={isOpen}>
        <DialogTitle>Setup AI Summaries</DialogTitle>
        <DialogContent>
          <EngineOption
            engine="bundled"
            title="Bundled Model (Recommended)"
            description="Works offline. ~1.5GB download required."
            selected={selectedEngine === 'bundled'}
            onClick={() => setSelectedEngine('bundled')}
          />
          <EngineOption
            engine="ollama"
            title="External Ollama"
            description="Use your own Ollama server."
            selected={selectedEngine === 'ollama'}
            onClick={() => setSelectedEngine('ollama')}
          />
          <EngineOption
            engine="cloud"
            title="Cloud API"
            description="Use Anthropic or OpenAI API."
            selected={selectedEngine === 'cloud'}
            onClick={() => setSelectedEngine('cloud')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleContinue} disabled={!selectedEngine}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  // Step 2: Downloading (if bundled selected)
  if (step === 'downloading') {
    return (
      <Dialog open={isOpen}>
        <DialogTitle>Downloading AI Model</DialogTitle>
        <DialogContent>
          <DownloadProgressBar
            progress={downloadProgress}
            onCancel={handleCancelDownload}
          />
          <Typography variant="caption">
            {downloadProgress.phase === 'server'
              ? 'Downloading llama-server (~50MB)...'
              : 'Downloading model (~1.5GB)...'}
          </Typography>
          <Typography variant="caption">
            {formatBytes(downloadProgress.downloaded)} /
            {formatBytes(downloadProgress.total)} -
            {downloadProgress.eta}
          </Typography>
        </DialogContent>
      </Dialog>
    )
  }

  // Step 3: Complete
  if (step === 'complete') {
    return (
      <Dialog open={isOpen}>
        <DialogTitle>Setup Complete!</DialogTitle>
        <DialogContent>
          <CheckCircleIcon color="success" />
          <Typography>AI summaries are now ready to use.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { onClose(); onComplete(); }}>
            Generate Summary
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}
```

**API Integration**:
```tsx
const handleContinue = async () => {
  if (selectedEngine === 'bundled') {
    setStep('downloading')

    try {
      // Start download with progress tracking
      await api.inference.downloadBundledModel({
        modelName: 'gemma-2-2b-it-q4',
        onProgress: (progress) => setDownloadProgress(progress)
      })

      setStep('complete')
    } catch (error) {
      toast.error(`Download failed: ${error.message}`)
      setStep('select')
    }
  } else if (selectedEngine === 'ollama') {
    // Show Ollama config form
    // ...
  } else if (selectedEngine === 'cloud') {
    // Show API key input form
    // ...
  }
}
```

**Testing**:
- Verify all 3 engine options render correctly
- Test download progress updates in real-time
- Test cancel during download (cleanup temp files)
- Test error handling (network failure, disk space)

---

#### 2.2 Update Session Detail Page (3 hours)

**File**: `/home/harshad/projects/traq/frontend/src/pages/SessionDetailPage.tsx`

**Changes**:

1. **Add setup dialog state**:
```tsx
const [showSetupDialog, setShowSetupDialog] = useState(false)
```

2. **Check inference status before generation**:
```tsx
const handleGenerateSummary = async () => {
  // Check if inference is ready
  const status = await api.inference.getSetupStatus()

  if (!status.ready) {
    // Show setup dialog
    setShowSetupDialog(true)
    return
  }

  // Proceed with generation
  await generateSummaryMutation.mutateAsync(sessionId)
}
```

3. **Always show "Generate Summary" button**:
```tsx
// Before: Only showed if summary exists
{summary && (
  <Button onClick={handleRegenerateSummary}>Regenerate Summary</Button>
)}

// After: Always show, text changes based on summary existence
<Button
  onClick={handleGenerateSummary}
  startIcon={<AutoAwesomeIcon />}
>
  {summary ? 'Regenerate Summary' : 'Generate Summary'}
</Button>
```

4. **Add setup dialog**:
```tsx
<SummarySetupDialog
  isOpen={showSetupDialog}
  onClose={() => setShowSetupDialog(false)}
  onComplete={() => {
    setShowSetupDialog(false)
    handleGenerateSummary()
  }}
/>
```

**Testing**:
- Fresh install: Click "Generate Summary" → Setup dialog appears
- After setup: Click "Generate Summary" → Works immediately
- With summary: Button shows "Regenerate Summary"

---

#### 2.3 Enhanced Settings UI (3 hours)

**File**: `/home/harshad/projects/traq/frontend/src/components/layout/SettingsDrawer.tsx`

**Add AI Setup Section**:
```tsx
<SettingsSection title="AI Configuration">
  {/* Inference Status Indicator */}
  <InferenceStatusBadge status={inferenceStatus} />

  {/* Engine Selection */}
  <FormControl>
    <FormLabel>Inference Engine</FormLabel>
    <RadioGroup value={engine} onChange={handleEngineChange}>
      <Radio value="bundled" label="Bundled Model (Offline)" />
      <Radio value="ollama" label="External Ollama" />
      <Radio value="cloud" label="Cloud API" />
    </RadioGroup>
  </FormControl>

  {/* Engine-Specific Config */}
  {engine === 'bundled' && (
    <BundledModelConfig
      modelName={modelName}
      onDownload={handleDownloadModel}
      onDelete={handleDeleteModel}
    />
  )}

  {engine === 'ollama' && (
    <OllamaConfig
      host={ollamaHost}
      model={ollamaModel}
      onChange={handleOllamaChange}
    />
  )}

  {engine === 'cloud' && (
    <CloudAPIConfig
      provider={provider}
      apiKey={apiKey}
      onChange={handleCloudChange}
    />
  )}

  {/* Test Connection Button */}
  <Button
    onClick={handleTestConnection}
    disabled={testConnectionMutation.isPending}
  >
    Test Connection
  </Button>
</SettingsSection>
```

**Status Badge Component**:
```tsx
function InferenceStatusBadge({ status }: { status: SetupStatus }) {
  if (status.ready) {
    return (
      <Chip
        icon={<CheckCircleIcon />}
        label="Ready"
        color="success"
      />
    )
  }

  return (
    <Tooltip title={status.suggestion}>
      <Chip
        icon={<ErrorIcon />}
        label={status.issue}
        color="error"
      />
    </Tooltip>
  )
}
```

**Testing**:
- Verify status badge updates correctly
- Test switching engines (bundled → ollama → cloud)
- Test download from settings page
- Verify test connection works for all engines

---

### Phase 3: API Endpoints

#### 3.1 New Backend API Methods (2 hours)

**File**: `/home/harshad/projects/traq/app.go`

**Add Methods**:
```go
// Get setup status
func (a *App) GetInferenceSetupStatus(ctx context.Context) (*inference.SetupStatus, error) {
    return a.inference.GetSetupStatus(ctx)
}

// Download bundled model with progress
func (a *App) DownloadBundledModel(ctx context.Context, modelName string) error {
    // Implementation delegates to inference service
    return a.inference.DownloadBundledModel(ctx, modelName, func(progress DownloadProgress) {
        // Emit progress event via Wails event system
        runtime.EventsEmit(ctx, "download-progress", progress)
    })
}

// Test inference connection
func (a *App) TestInferenceConnection(ctx context.Context) error {
    return a.inference.TestConnection(ctx)
}
```

**Testing**:
- Call `GetInferenceSetupStatus` from frontend, verify structure
- Start download, verify progress events emitted
- Test connection for each engine type

---

### Phase 4: Edge Cases & Error Handling

#### 4.1 Partial Download Recovery (2 hours)

**File**: `/home/harshad/projects/traq/internal/inference/bundled.go`

**Update DownloadModel()**:
```go
func (e *BundledEngine) DownloadModel(ctx context.Context, modelName string, progressFn ProgressFunc) error {
    tempPath := filepath.Join(e.paths.ModelsDir, modelName + ".gguf.tmp")
    finalPath := filepath.Join(e.paths.ModelsDir, modelName + ".gguf")

    // Check if partial download exists
    var resumeOffset int64
    if stat, err := os.Stat(tempPath); err == nil {
        resumeOffset = stat.Size()
        log.Printf("Resuming download from %d bytes", resumeOffset)
    }

    // HTTP range request for resume
    req, _ := http.NewRequestWithContext(ctx, "GET", downloadURL, nil)
    if resumeOffset > 0 {
        req.Header.Set("Range", fmt.Sprintf("bytes=%d-", resumeOffset))
    }

    // ... rest of download logic with resumption support

    // On success, rename temp to final
    if err := os.Rename(tempPath, finalPath); err != nil {
        return fmt.Errorf("failed to finalize download: %w", err)
    }

    return nil
}
```

**Cleanup on Cancel**:
```go
func (e *BundledEngine) CancelDownload() {
    // Set cancel flag
    e.downloadCancel.Store(true)

    // Keep temp file for resumption
    log.Println("Download cancelled, temp file preserved for resume")
}
```

**Testing**:
- Start download, cancel midway, restart → Resumes from where it stopped
- Verify temp file cleanup on successful completion
- Verify temp file preserved on cancellation

---

#### 4.2 Network Failure Retry (1 hour)

**Add Retry Logic**:
```go
func downloadWithRetry(ctx context.Context, url string, retries int) (*http.Response, error) {
    var lastErr error
    backoff := 1 * time.Second

    for i := 0; i < retries; i++ {
        resp, err := http.Get(url)
        if err == nil && resp.StatusCode == http.StatusOK {
            return resp, nil
        }

        lastErr = err
        log.Printf("Download attempt %d failed: %v, retrying in %v", i+1, err, backoff)

        time.Sleep(backoff)
        backoff *= 2 // Exponential backoff
    }

    return nil, fmt.Errorf("download failed after %d retries: %w", retries, lastErr)
}
```

**Testing**:
- Simulate network disconnection during download
- Verify retries with exponential backoff
- Verify final error after max retries

---

#### 4.3 Permission Errors (1 hour)

**Check Permissions Before Download**:
```go
func (e *BundledEngine) checkPermissions() error {
    // Try creating test file in models directory
    testPath := filepath.Join(e.paths.ModelsDir, ".write_test")

    f, err := os.Create(testPath)
    if err != nil {
        return fmt.Errorf("no write permission to models directory: %w", err)
    }
    f.Close()
    os.Remove(testPath)

    return nil
}
```

**User-Friendly Error**:
```go
if err := checkPermissions(); err != nil {
    return fmt.Errorf("cannot write to %s. Please check directory permissions or choose a different location in Settings", e.paths.ModelsDir)
}
```

**Testing**:
- Make models dir read-only, verify clear error message
- Verify works with correct permissions

---

### Phase 5: Testing & Verification

#### 5.1 End-to-End Fresh Install Test

**Prerequisites**: Clean slate
```bash
# Remove all Traq data
rm -rf ~/.local/share/traq/
rm -rf ~/.config/traq/

# Ensure Ollama not running
pkill ollama
```

**Test Steps**:
1. Start app: `make dev`
2. Create test session:
   - Open test app (browser, editor, terminal)
   - Wait 5 minutes for screenshots to be captured
3. Navigate to session detail page
4. Verify "Generate Summary" button visible
5. Click "Generate Summary"
6. **Expected**: Setup dialog appears
7. Select "Bundled Model (Recommended)"
8. Click "Continue"
9. **Expected**: Download progress dialog shows
   - Server download (~50MB) completes
   - Model download (~1.5GB) progresses with ETA
10. **Expected**: After completion, summary generates automatically
11. Verify summary displays in UI
12. Create another session
13. Click "Generate Summary"
14. **Expected**: No dialog, summary generates immediately

**Pass Criteria**:
- ✅ Setup dialog appears on first use
- ✅ Download completes successfully
- ✅ Summary generates after setup
- ✅ Future summaries work without dialog
- ✅ Summary content is relevant (not placeholder)

---

#### 5.2 Error Scenario Testing

**Test 1: Insufficient Disk Space**
```bash
# Fill disk to near capacity
# Start download
# Expected: Error before download starts: "Insufficient disk space: 0.5GB available, 1.5GB required"
```

**Test 2: Network Failure Mid-Download**
```bash
# Start download
# Disable network after 500MB downloaded
# Expected: Retry attempts with exponential backoff
# Re-enable network
# Expected: Download resumes from 500MB
```

**Test 3: Ollama Not Running**
```bash
# Configure Ollama in settings
# Stop Ollama service
# Try to generate summary
# Expected: "Ollama not reachable at localhost:11434. Install and start Ollama from https://ollama.com"
```

**Test 4: Permission Denied**
```bash
chmod 555 ~/.local/share/traq/models/
# Try to download
# Expected: "Cannot write to ~/.local/share/traq/models/. Please check directory permissions..."
```

---

#### 5.3 UI/UX Verification

**Checklist**:
- [ ] Setup dialog is visually clear and not intimidating
- [ ] Bundled option is marked as "Recommended"
- [ ] Download progress shows bytes downloaded, total, and ETA
- [ ] Progress bar animates smoothly
- [ ] Cancel button works and preserves partial download
- [ ] Error messages are actionable (not technical)
- [ ] Success state feels rewarding (checkmark icon, positive message)
- [ ] Settings page shows current engine and status
- [ ] Test connection button provides immediate feedback

---

## Critical Files Summary

**Must Modify**:
1. `/home/harshad/projects/traq/internal/service/config.go` - Change default engine to bundled
2. `/home/harshad/projects/traq/internal/inference/inference.go` - Add GetSetupStatus()
3. `/home/harshad/projects/traq/internal/service/summary.go` - Enhanced error handling
4. `/home/harshad/projects/traq/internal/inference/bundled.go` - Disk space check, retry logic
5. `/home/harshad/projects/traq/frontend/src/pages/SessionDetailPage.tsx` - Generate button + dialog
6. `/home/harshad/projects/traq/frontend/src/components/session/SummarySetupDialog.tsx` - New component
7. `/home/harshad/projects/traq/frontend/src/components/layout/SettingsDrawer.tsx` - Enhanced AI settings
8. `/home/harshad/projects/traq/app.go` - New API methods

**May Reference**:
- `/home/harshad/projects/traq/internal/inference/models.go` - Model catalog
- `/home/harshad/projects/traq/frontend/src/hooks/useInferenceStatus.ts` - Status hook
- `/home/harshad/projects/traq/frontend/src/api/client.ts` - API client

---

## Time Estimates

**Backend**: 12 hours
- Config changes: 2h
- Setup status detection: 3h
- Error handling: 2h
- Disk space check: 2h
- Edge cases (retry, permissions): 3h

**Frontend**: 11 hours
- Setup dialog component: 5h
- Session detail updates: 3h
- Settings UI enhancements: 3h

**Testing**: 4 hours
- Fresh install E2E test: 2h
- Error scenario testing: 1h
- UI/UX verification: 1h

**Total: 27 hours** (3-4 focused days)

---

## Post-Implementation: Re-Audit Criteria

After fixing AI summaries, use these enhanced criteria for re-auditing all "PASS" features:

**New Audit Standard**:
1. ✅ Code exists (backend + frontend)
2. ✅ Tests pass
3. ✅ **Works on fresh install without manual setup**
4. ✅ **Error messages are actionable**
5. ✅ **Required dependencies are bundled or auto-downloaded**
6. ✅ **UI exposes feature clearly (buttons, status, etc.)**

**Features to Re-Audit First** (likely have similar gaps):
- Shell command tracking (may need setup wizard)
- Git activity tracking (may need repo registration flow)
- Browser history tracking (may need browser selection)
- Reports (natural language date parsing may fail silently)

This will reveal how many other "PASS" features have usability gaps like AI summaries did.

---

## Next Steps After This Plan Approved

1. Implement backend changes (Phase 1)
2. Implement frontend changes (Phase 2)
3. Add API endpoints (Phase 3)
4. Handle edge cases (Phase 4)
5. Run full test suite (Phase 5)
6. Document setup flow for users
7. Re-audit all 148 features with new criteria
