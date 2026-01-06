# Traq Development Protocol — MANDATORY

## The Prime Directive

**"Done" means the app runs and the feature works when a human clicks on it.**

Not "compiles." Not "tests exist." Not "I updated the code."

DONE = Human opens app → clicks thing → thing works → no errors in console.

---

## The TDD Contract

You MUST follow this sequence for EVERY feature, fix, or change. No exceptions.

### Step 1: Understand What "Working" Means

Before writing ANY code, state explicitly:
```
ACCEPTANCE CRITERIA:
- [ ] User can [specific action]
- [ ] UI shows [specific result]
- [ ] Data persists in [specific location]
- [ ] No console errors
- [ ] No negative numbers / null references / placeholder text
```

### Step 2: Write Failing Tests FIRST

```bash
# Create test file if doesn't exist
touch internal/[package]/[feature]_test.go

# Write tests that define correct behavior
# Tests MUST cover:
# - Happy path (normal input → expected output)
# - Edge cases (null, zero, empty, negative)
# - Error conditions (missing file, bad data)
```

Example test structure:
```go
func TestFeatureName_HappyPath(t *testing.T) {
    // Setup
    // Action
    // Assert expected outcome
}

func TestFeatureName_NullInput(t *testing.T) {
    // What happens when input is nil?
}

func TestFeatureName_EdgeCase(t *testing.T) {
    // What happens at boundaries?
}
```

### Step 3: Run Tests — They MUST Fail

```bash
go test ./internal/[package]/ -v -run TestFeatureName
```

If tests pass before you write the implementation, your tests are wrong.
Delete them and write real tests.

### Step 4: Implement the Feature

Write the minimum code to make tests pass. No more.

### Step 5: Run Tests — They MUST Pass

```bash
go test ./... -v
```

ALL tests must pass. If any fail, fix before proceeding.

### Step 6: Run the Actual App

```bash
wails build -tags webkit2_41 && ./build/bin/traq
```

Then:
1. Open the app
2. Navigate to the feature you just built
3. Click on things
4. Verify it actually works visually
5. Check browser console for errors (F12 in Wails dev mode)

### Step 7: Report Honestly

```
IMPLEMENTATION COMPLETE:

Tests written: [list test functions]
Tests passing: [yes/no]
App tested manually: [yes/no]

What works:
- [specific thing user can do]

What doesn't work yet:
- [specific thing still broken]

Known issues:
- [any warnings, edge cases, todos]
```

---

## Forbidden Behaviors

### ❌ NEVER say "Done" if:
- You haven't run `go test ./...`
- You haven't built and opened the app
- You're showing placeholder/mock data
- There are console errors you're ignoring
- Math could produce negative numbers and you haven't tested it
- Pointers could be nil and you haven't checked
- File paths could not exist and you haven't verified

### ❌ NEVER skip tests because:
- "It's simple code"
- "I'll add tests later"
- "The types guarantee correctness"
- "It worked when I traced through it mentally"

### ❌ NEVER leave:
- `// TODO` comments without telling the user
- Placeholder data in the UI
- Hardcoded values that should be dynamic
- Console.log / fmt.Println debugging statements

---

## Test Requirements by Component

### Storage Layer (internal/storage/)
```
MUST TEST:
- Create returns valid ID
- Read returns what was written
- Update modifies existing record
- Delete removes record
- Query with no results returns empty slice, not nil
- Query with date range filters correctly
- Null/optional fields handled correctly
```

### Platform Layer (internal/platform/)
```
MUST TEST (integration tests, tagged):
- GetActiveWindow returns real window info
- GetLastInputTime returns recent timestamp
- DataDir returns existing, writable path
- All paths use correct OS separators
```

### Trackers (internal/tracker/)
```
MUST TEST:
- Capture produces file on disk
- Capture result has all fields populated
- Duplicate detection works (same image = similar hash)
- Session creates on first activity
- Session ends on AFK
- Session resumes if return within timeout
- New session if return after timeout
- Poll methods handle errors gracefully
```

### Services (internal/service/)
```
MUST TEST:
- Null/zero inputs don't crash
- Empty database returns empty results, not error
- Date parsing handles various formats
- Duration calculations never negative
- Percentages sum to ~100%
- All optional fields have defaults
```

### Frontend (frontend/src/)
```
MUST TEST:
- Components render without crashing
- Null/undefined data shows fallback UI, not error
- Loading states display during fetch
- Error states display on failure
- Click handlers fire correctly
```

---

## The Verification Checklist

Run this before declaring ANY feature complete:

```bash
#!/bin/bash
echo "=== TRAQ VERIFICATION ==="

echo -e "\n[1/5] Running all tests..."
go test ./... -v || { echo "❌ TESTS FAILED"; exit 1; }

echo -e "\n[2/5] Building app..."
wails build -tags webkit2_41 || { echo "❌ BUILD FAILED"; exit 1; }

echo -e "\n[3/5] Checking for TODOs..."
grep -r "TODO\|FIXME\|XXX\|HACK" internal/ frontend/src/ --include="*.go" --include="*.ts" --include="*.tsx" && echo "⚠️  TODOs found"

echo -e "\n[4/5] Checking for debug statements..."
grep -r "fmt.Println\|console.log\|print(" internal/ frontend/src/ --include="*.go" --include="*.ts" --include="*.tsx" && echo "⚠️  Debug statements found"

echo -e "\n[5/5] Checking for placeholder data..."
grep -r "placeholder\|mock\|dummy\|fake\|sample\|TODO\|xxx" frontend/src/ --include="*.ts" --include="*.tsx" && echo "⚠️  Placeholder data found"

echo -e "\n=== VERIFICATION COMPLETE ==="
echo "Now manually test: ./build/bin/traq"
```

---

## Communication Protocol

### When Starting a Task
```
STARTING: [task name]

Acceptance criteria:
1. [specific measurable outcome]
2. [specific measurable outcome]

Tests I will write:
- TestXxx_HappyPath
- TestXxx_NullInput
- TestXxx_EdgeCase
```

### When Blocked
```
BLOCKED: [reason]

I need:
- [specific thing - package to install, decision, clarification]

I will NOT proceed by:
- Skipping the feature
- Using placeholder data
- Leaving it half-implemented
```

### When Complete
```
COMPLETE: [task name]

Tests: [X passing, 0 failing]
Build: [success/fail]
Manual test: [yes - describe what you tested]

Remaining work:
- [anything not done, or "None"]
```

---

## Feature-Specific Checklists

### Screenshot Capture
```
□ Files appear in ~/.local/share/traq/screenshots/YYYY/MM/DD/
□ Thumbnails generated alongside full images
□ Database has rows with valid timestamps
□ UI displays actual images, not placeholders
□ Clicking image opens larger view
```

### Session Management
```
□ Session created when app starts and user is active
□ Session ends when AFK detected
□ Duration shows correct positive number
□ Ongoing sessions show "ongoing" not negative time
□ Sessions persist across app restart
```

### Shell History Tracker
```
□ Commands appear in database after running terminal commands
□ Analytics shows non-zero command count
□ Sensitive commands (with password/token) are filtered
□ Works with user's actual shell (bash/zsh/fish)
```

### Git Tracker
```
□ Commits appear after `git commit` in tracked repos
□ Analytics shows non-zero commit count
□ Commit messages stored correctly
□ Multiple repos tracked independently
```

### File Watcher
```
□ New files in ~/Downloads appear in database
□ Modified files in watched dirs trigger events
□ Analytics shows non-zero file count
□ Debouncing works (rapid saves = one event)
```

### Browser History
```
□ Recent URLs appear in database
□ Works with installed browser (Chrome/Firefox)
□ Analytics shows non-zero sites visited
□ Domain extraction works correctly
```

### AI Summarization
```
□ Bundled llama.cpp starts with app (or external Ollama connects)
□ Can generate summary for a session
□ Summary appears in Timeline view
□ Confidence and tags displayed
□ Model can be changed in settings
```

---

## Remember

Every bug that reaches the user is a test you didn't write.

`-3535267740s` happened because nobody wrote:
```go
func TestDuration_NullEndTime(t *testing.T) {
    session := Session{StartTime: 1000, EndTime: nil}
    if session.Duration() < 0 {
        t.Error("Duration should not be negative")
    }
}
```

That's a 5-line test. Write it first next time.

---

## Final Word

I don't care if the code is elegant.
I don't care if it uses the latest patterns.
I don't care if you refactored it three times.

I care that when I open the app and click on things, **it fucking works.**

Test it. Run it. Click it. Then tell me it's done.
