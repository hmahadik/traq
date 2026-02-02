package service

import "traq/internal/storage"

// DraftService handles draft acceptance/rejection for AI-generated content.
type DraftService struct {
	store *storage.Store
}

// NewDraftService creates a new DraftService.
func NewDraftService(store *storage.Store) *DraftService {
	return &DraftService{store: store}
}

// AcceptSummaryDraft marks a summary draft as accepted.
func (s *DraftService) AcceptSummaryDraft(summaryID int64) error {
	return s.store.UpdateSummaryDraftStatus(summaryID, false, "accepted")
}

// RejectSummaryDraft marks a summary draft as rejected.
func (s *DraftService) RejectSummaryDraft(summaryID int64) error {
	return s.store.UpdateSummaryDraftStatus(summaryID, false, "rejected")
}

// AcceptAssignmentDraft marks a project assignment draft as accepted.
func (s *DraftService) AcceptAssignmentDraft(activityID int64) error {
	return s.store.UpdateFocusEventDraftStatus(activityID, false, "accepted")
}

// RejectAssignmentDraft marks a project assignment draft as rejected.
func (s *DraftService) RejectAssignmentDraft(activityID int64) error {
	return s.store.UpdateFocusEventDraftStatus(activityID, false, "rejected")
}

// BulkAcceptDrafts accepts multiple drafts at once.
func (s *DraftService) BulkAcceptDrafts(summaryIDs, assignmentIDs []int64) error {
	for _, id := range summaryIDs {
		if err := s.AcceptSummaryDraft(id); err != nil {
			return err
		}
	}
	for _, id := range assignmentIDs {
		if err := s.AcceptAssignmentDraft(id); err != nil {
			return err
		}
	}
	return nil
}

// BulkAcceptDraftsBySession accepts drafts using session IDs and activity IDs.
// Session IDs are resolved to their corresponding summary IDs internally.
// Activities that don't have drafts are silently skipped.
func (s *DraftService) BulkAcceptDraftsBySession(sessionIDs, activityIDs []int64) error {
	for _, sessionID := range sessionIDs {
		sum, err := s.store.GetSummaryBySession(sessionID)
		if err != nil || sum == nil {
			continue // Skip sessions without summaries
		}
		if err := s.AcceptSummaryDraft(sum.ID); err != nil {
			return err
		}
	}
	for _, id := range activityIDs {
		if err := s.AcceptAssignmentDraft(id); err != nil {
			return err
		}
	}
	return nil
}
