// Detailed report generation for the reports service.

package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"traq/internal/storage"
)

// extractAccomplishmentsOptimized pulls key accomplishments from session summaries
// using a pre-loaded summaries map (eliminates N+1 queries).
func (s *ReportsService) extractAccomplishmentsOptimized(sessions []*storage.Session, summariesMap map[int64]*storage.Summary) []string {
	var accomplishments []string
	seen := make(map[string]bool)

	for _, sess := range sessions {
		// First try the preloaded map (optimized path)
		if sum, ok := summariesMap[sess.ID]; ok && sum != nil && sum.Summary != "" {
			summary := sum.Summary
			if !seen[summary] && !isGenericSummary(summary) {
				seen[summary] = true
				accomplishments = append(accomplishments, summary)
			}
		} else if sess.SummaryID.Valid {
			// Fallback to direct lookup if not in map
			sum, err := s.store.GetSummary(sess.SummaryID.Int64)
			if err == nil && sum != nil && sum.Summary != "" {
				summary := sum.Summary
				if !seen[summary] && !isGenericSummary(summary) {
					seen[summary] = true
					accomplishments = append(accomplishments, summary)
				}
			}
		}
	}

	// Limit to top 5
	if len(accomplishments) > 5 {
		accomplishments = accomplishments[:5]
	}

	return accomplishments
}

// generateDetailedReport creates a detailed HTML report with all data.
func (s *ReportsService) generateDetailedReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	// === START BUILDING HTML REPORT ===
	sb.WriteString(`<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; color: #e2e8f0;">`)

	// Header
	sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 24px;">
		<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 8px 0; color: #f1f5f9;">Detailed Activity Report: %s</h1>
		<p style="color: #94a3b8; margin: 0; font-size: 0.9rem;">Generated: %s</p>
	</div>`, tr.Label, time.Now().Format("2006-01-02 15:04")))

	// Collect all timeline events
	var timelineEvents []TimelineEvent

	// Get git commits
	gitCommits, _ := s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)
	for _, commit := range gitCommits {
		timelineEvents = append(timelineEvents, TimelineEvent{
			Timestamp: commit.Timestamp,
			Type:      "git",
			Summary:   fmt.Sprintf(`<span style="font-weight: 600; color: #f97316;">[Git]</span> <code style="font-size: 0.85em; background: rgba(249, 115, 22, 0.1); padding: 2px 6px; border-radius: 4px; color: #f97316;">%s</code> %s`, esc(commit.ShortHash), esc(commit.Message)),
		})
	}

	// Get shell commands
	shellCommands, _ := s.store.GetShellCommandsByTimeRange(tr.Start, tr.End)
	for _, cmd := range shellCommands {
		cmdText := cmd.Command
		if len(cmdText) > 80 {
			cmdText = cmdText[:77] + "..."
		}
		timelineEvents = append(timelineEvents, TimelineEvent{
			Timestamp: cmd.Timestamp,
			Type:      "shell",
			Summary:   fmt.Sprintf(`<span style="font-weight: 600; color: #3b82f6;">[Shell]</span> <code style="font-size: 0.85em; background: rgba(59, 130, 246, 0.1); padding: 2px 6px; border-radius: 4px; color: #60a5fa;">%s</code>`, esc(cmdText)),
		})
	}

	// Get file events
	fileEvents, _ := s.store.GetFileEventsByTimeRange(tr.Start, tr.End)
	for _, fileEvt := range fileEvents {
		fileName := fileEvt.FileName
		if fileEvt.FileExtension.Valid && fileEvt.FileExtension.String != "" {
			fileName += fileEvt.FileExtension.String
		}
		timelineEvents = append(timelineEvents, TimelineEvent{
			Timestamp: fileEvt.Timestamp,
			Type:      "file",
			Summary:   fmt.Sprintf(`<span style="font-weight: 600; color: #22c55e;">[File]</span> %s: <code style="font-size: 0.85em; background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px; color: #4ade80;">%s</code>`, esc(fileEvt.EventType), esc(fileName)),
		})
	}

	// Sort by timestamp
	for i := 0; i < len(timelineEvents)-1; i++ {
		for j := i + 1; j < len(timelineEvents); j++ {
			if timelineEvents[i].Timestamp > timelineEvents[j].Timestamp {
				timelineEvents[i], timelineEvents[j] = timelineEvents[j], timelineEvents[i]
			}
		}
	}

	// Event Timeline Section
	sb.WriteString(`<div style="margin-bottom: 32px;">
		<div style="font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid rgba(148, 163, 184, 0.2);">📅 Event Timeline</div>
		<p style="color: #94a3b8; margin-bottom: 16px; font-size: 0.85rem;">All events in chronological order</p>`)

	if len(timelineEvents) > 0 {
		sb.WriteString(`<div style="background: rgba(30, 41, 59, 0.3); border-radius: 8px; padding: 16px;">`)
		for _, evt := range timelineEvents {
			evtTime := time.Unix(evt.Timestamp, 0)
			sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
				<div style="font-family: monospace; color: #94a3b8; font-size: 0.85rem; min-width: 70px;">%s</div>
				<div style="font-size: 0.9rem; color: #cbd5e1; flex: 1;">%s</div>
			</div>`, evtTime.Format("15:04:05"), evt.Summary))
		}
		sb.WriteString(`</div>`)
	} else {
		sb.WriteString(`<p style="color: #64748b; font-style: italic; font-size: 0.9rem;">No events recorded for this period</p>`)
	}
	sb.WriteString(`</div>`)

	// Sessions Section
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)

	if len(sessions) > 0 {
		sb.WriteString(`<div style="margin-bottom: 32px;">
			<div style="font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid rgba(148, 163, 184, 0.2);">🎯 Sessions</div>`)

		for _, sess := range sessions {
			ctx, _ := s.timeline.GetSessionContext(sess.ID)
			if ctx == nil {
				continue
			}

			startTime := time.Unix(sess.StartTime, 0)
			sb.WriteString(fmt.Sprintf(`<div style="background: rgba(30, 41, 59, 0.4); border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 3px solid #3b82f6;">
				<div style="font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Session: %s</div>`, startTime.Format("2006-01-02 15:04")))

			if sess.DurationSeconds.Valid {
				minutes := sess.DurationSeconds.Int64 / 60
				sb.WriteString(fmt.Sprintf(`<div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 12px;">Duration: %dh %dm</div>`, minutes/60, minutes%60))
			}

			// Summary
			if ctx.Summary != nil {
				sb.WriteString(`<div style="margin-bottom: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #3b82f6; margin-bottom: 6px;">Summary</div>`)
				sb.WriteString(fmt.Sprintf(`<p style="color: #cbd5e1; font-size: 0.9rem; margin: 0;">%s</p>`, esc(ctx.Summary.Summary)))
				if ctx.Summary.Explanation.Valid && ctx.Summary.Explanation.String != "" {
					sb.WriteString(fmt.Sprintf(`<p style="color: #94a3b8; font-size: 0.85rem; margin-top: 8px; margin-bottom: 0;"><strong>Explanation:</strong> %s</p>`, esc(ctx.Summary.Explanation.String)))
				}
				if len(ctx.Summary.Tags) > 0 {
					sb.WriteString(`<div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">`)
					for _, tag := range ctx.Summary.Tags {
						sb.WriteString(fmt.Sprintf(`<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">%s</span>`, esc(tag)))
					}
					sb.WriteString(`</div>`)
				}
				sb.WriteString(`</div>`)
			}

			// Application Focus
			if len(ctx.FocusEvents) > 0 {
				sb.WriteString(`<div style="margin-bottom: 16px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Application Focus</div>
					<div style="background: rgba(30, 41, 59, 0.5); border-radius: 6px; overflow: hidden;">
						<table style="width: 100%; border-collapse: collapse;">
							<thead>
								<tr style="background: rgba(148, 163, 184, 0.1);">
									<th style="text-align: left; padding: 8px 12px; font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Application</th>
									<th style="text-align: right; padding: 8px 12px; font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Duration</th>
								</tr>
							</thead>
							<tbody>`)

				appDurations := make(map[string]float64)
				for _, evt := range ctx.FocusEvents {
					appDurations[evt.AppName] += evt.DurationSeconds
				}
				for app, dur := range appDurations {
					minutes := int(dur / 60)
					sb.WriteString(fmt.Sprintf(`<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.05);">
						<td style="padding: 8px 12px; font-size: 0.85rem; color: #e2e8f0;">%s</td>
						<td style="padding: 8px 12px; font-size: 0.85rem; color: #94a3b8; text-align: right;">%dm</td>
					</tr>`, esc(GetFriendlyAppName(app)), minutes))
				}

				sb.WriteString(`</tbody></table></div></div>`)

				// === WINDOW DETAILS FOR THIS SESSION ===
				sessionFocusEvents, _ := s.store.GetWindowFocusEventsBySession(sess.ID)
				if len(sessionFocusEvents) > 0 {
					sb.WriteString(`<div style="margin-top: 12px;">
						<div style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase;">Window Details</div>`)

					// Group by app
					appWindows := make(map[string]map[string]float64)
					for _, evt := range sessionFocusEvents {
						if appWindows[evt.AppName] == nil {
							appWindows[evt.AppName] = make(map[string]float64)
						}
						appWindows[evt.AppName][evt.WindowTitle] += evt.DurationSeconds
					}

					for appName, windows := range appWindows {
						sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 8px;">
							<div style="font-size: 0.8rem; color: #e2e8f0; font-weight: 500;">%s</div>`,
							esc(GetFriendlyAppName(appName))))

						// Sort windows by duration
						type wdur struct {
							title string
							dur   float64
						}
						var sorted []wdur
						for t, d := range windows {
							sorted = append(sorted, wdur{t, d})
						}
						sort.Slice(sorted, func(i, j int) bool {
							return sorted[i].dur > sorted[j].dur
						})

						for i, w := range sorted {
							if i >= 3 {
								break
							}
							mins := int64(w.dur / 60)
							if mins < 1 {
								continue
							}
							title := w.title
							if len(title) > 40 {
								title = title[:37] + "..."
							}
							sb.WriteString(fmt.Sprintf(`
								<div style="font-size: 0.75rem; color: #94a3b8; padding-left: 12px;">
									• %s (%s)
								</div>`, esc(title), formatMinutes(mins)))
						}
						sb.WriteString(`</div>`)
					}
					sb.WriteString(`</div>`)
				}
			}

			// Shell Commands
			if len(ctx.ShellCommands) > 0 {
				sb.WriteString(`<div style="margin-bottom: 16px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Shell Commands</div>
					<div style="background: rgba(0, 0, 0, 0.3); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.8rem; color: #94a3b8; overflow-x: auto;">`)
				for _, cmd := range ctx.ShellCommands {
					sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 4px;">%s</div>`, esc(cmd.Command)))
				}
				sb.WriteString(`</div></div>`)
			}

			// Git Commits
			if len(ctx.GitCommits) > 0 {
				sb.WriteString(`<div style="margin-bottom: 16px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Git Commits</div>`)
				for _, commit := range ctx.GitCommits {
					sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: baseline;">
						<code style="font-size: 0.75rem; color: #f97316; background: rgba(249, 115, 22, 0.15); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">%s</code>
						<span style="font-size: 0.85rem; color: #cbd5e1;">%s</span>
					</div>`, esc(commit.ShortHash), esc(commit.Message)))
				}
				sb.WriteString(`</div>`)
			}

			sb.WriteString(`</div>`) // End session card
		}

		sb.WriteString(`</div>`) // End sessions section
	}

	sb.WriteString(`</div>`) // End main container

	return sb.String(), nil
}
