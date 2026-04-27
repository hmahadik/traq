// Standup report generation for the reports service.

package service

import (
	"fmt"
	"strings"
)

// generateStandupReport creates an HTML standup-style report following the standard 3-question format.
func (s *ReportsService) generateStandupReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	// Get sessions first (needed for batch loading summaries)
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)

	// Batch load all summaries for these sessions (optimization)
	sessionIDs := make([]int64, len(sessions))
	for i, sess := range sessions {
		sessionIDs[i] = sess.ID
	}
	summariesMap, _ := s.store.GetSummariesForSessions(sessionIDs)

	// Get app usage and calculate total time
	appUsage, _ := s.analytics.GetAppUsage(tr.Start, tr.End)
	var totalMinutes int64
	for _, app := range appUsage {
		totalMinutes += int64(app.DurationSeconds / 60)
	}

	// Get commits
	commits, _ := s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)

	// === START HTML ===
	sb.WriteString(`<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; color: #e2e8f0;">`)

	// Header with summary
	sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 20px;">
		<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 8px 0; color: #f1f5f9;">Standup Report: %s</h1>
		<p style="color: #94a3b8; margin: 0; font-size: 0.9rem;">%s tracked across %d sessions</p>
	</div>`, tr.Label, formatMinutes(totalMinutes), len(sessions)))

	// === WHAT I ACCOMPLISHED ===
	sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 3px solid #22c55e;">
		<div style="font-size: 0.85rem; font-weight: 600; color: #22c55e; margin-bottom: 12px;">✓ What I accomplished</div>`)

	accomplishments := s.extractAccomplishmentsOptimized(sessions, summariesMap)
	if len(accomplishments) > 0 {
		for _, acc := range accomplishments {
			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; padding-left: 8px;">• %s</div>`, esc(acc)))
		}
	} else if len(commits) > 0 {
		sb.WriteString(`<div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">Based on commits:</div>`)
		seen := make(map[string]bool)
		count := 0
		for _, commit := range commits {
			if !seen[commit.Message] && count < 5 {
				seen[commit.Message] = true
				sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; padding-left: 8px;">• %s</div>`, esc(commit.Message)))
				count++
			}
		}
	} else {
		sb.WriteString(`<div style="font-size: 0.85rem; color: #64748b; font-style: italic;">No specific accomplishments recorded</div>`)
	}
	sb.WriteString(`</div>`)

	// === MEETINGS SECTION ===
	enhancedCtx, err := s.buildEnhancedReportContext(tr)
	if err == nil && len(enhancedCtx.Meetings) > 0 {
		sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 3px solid #3b82f6;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #3b82f6; margin-bottom: 12px;">📅 Meetings</div>`)

		for _, meeting := range enhancedCtx.Meetings {
			mins := int64(meeting.DurationSeconds / 60)
			if mins < 1 {
				continue
			}

			icon := "📞"
			switch meeting.Platform {
			case "Slack":
				icon = "💬"
			case "Zoom":
				icon = "📹"
			case "Meet":
				icon = "🎥"
			case "Teams":
				icon = "👥"
			}

			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; padding-left: 8px;">
				%s %s: %s (%s)
			</div>`, icon, esc(meeting.Platform), esc(meeting.Title), formatMinutes(mins)))
		}

		sb.WriteString(`</div>`)
	}

	// === COMMITS ===
	if len(commits) > 0 {
		sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 3px solid #f97316;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f97316; margin-bottom: 12px;">📝 Commits</div>`)
		seen := make(map[string]bool)
		for _, commit := range commits {
			if !seen[commit.Message] {
				seen[commit.Message] = true
				sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: baseline;">
					<code style="font-size: 0.7rem; color: #f97316; background: rgba(249, 115, 22, 0.15); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">%s</code>
					<span style="font-size: 0.85rem; color: #cbd5e1;">%s</span>
				</div>`, esc(commit.ShortHash), esc(commit.Message)))
			}
		}
		sb.WriteString(`</div>`)
	}

	// === WHAT'S NEXT ===
	sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 3px solid #3b82f6;">
		<div style="font-size: 0.85rem; font-weight: 600; color: #3b82f6; margin-bottom: 12px;">🎯 What's next</div>`)

	if len(commits) > 0 {
		lastCommit := commits[len(commits)-1]
		if strings.Contains(strings.ToLower(lastCommit.Message), "wip") ||
			strings.Contains(strings.ToLower(lastCommit.Message), "in progress") {
			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; padding-left: 8px;">• Continue work on: %s</div>`, esc(lastCommit.Message)))
		} else {
			sb.WriteString(`<div style="font-size: 0.85rem; color: #64748b; font-style: italic; padding-left: 8px;">Add your planned tasks here</div>`)
		}
	} else {
		sb.WriteString(`<div style="font-size: 0.85rem; color: #64748b; font-style: italic; padding-left: 8px;">Add your planned tasks here</div>`)
	}
	sb.WriteString(`</div>`)

	// === BLOCKERS ===
	sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(100, 116, 139, 0.1); border-radius: 8px; border-left: 3px solid #64748b;">
		<div style="font-size: 0.85rem; font-weight: 600; color: #94a3b8; margin-bottom: 12px;">🚧 Blockers</div>
		<div style="font-size: 0.85rem; color: #64748b; padding-left: 8px;">• None identified</div>
	</div>`)

	// === TIME SUMMARY ===
	if len(appUsage) > 0 {
		sb.WriteString(`<div style="margin-bottom: 20px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">⏱️ Time Summary</div>`)

		maxDuration := appUsage[0].DurationSeconds
		count := 0
		for _, app := range appUsage {
			if count >= 5 {
				break
			}
			appName := GetFriendlyAppName(app.AppName)
			category := s.analytics.CategorizeApp(app.AppName)
			barWidth := int(app.DurationSeconds / maxDuration * 100)
			barColor := "#64748b"
			if category == CategoryProductive {
				barColor = "#22c55e"
			} else if category == CategoryDistracting {
				barColor = "#ef4444"
			}

			sb.WriteString(fmt.Sprintf(`
			<div style="display: flex; align-items: center; margin-bottom: 6px;">
				<div style="width: 80px; font-size: 0.8rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">%s</div>
				<div style="flex: 1; height: 16px; background: rgba(30, 41, 59, 0.5); border-radius: 4px; margin: 0 12px; overflow: hidden;">
					<div style="height: 100%%; width: %d%%; background: %s; border-radius: 4px;"></div>
				</div>
				<div style="width: 45px; text-align: right; font-size: 0.8rem; color: #94a3b8;">%s</div>
			</div>`, esc(appName), barWidth, barColor, formatMinutes(int64(app.DurationSeconds/60))))
			count++
		}
		sb.WriteString(`</div>`)
	}

	sb.WriteString(`</div>`) // End main container

	return sb.String(), nil
}
