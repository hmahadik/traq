package service

import (
	"context"
	"log"
	"time"

	"traq/internal/storage"
)

// BackfillEmbeddings regenerates embeddings for historical data.
// Processes activities in batches with context cancellation support.
func (s *EmbeddingService) BackfillEmbeddings(ctx context.Context, since time.Time) error {
	log.Printf("Starting embedding backfill from %s", since.Format("2006-01-02"))

	// Get activities without embeddings
	activities, err := s.store.GetActivitiesWithoutEmbeddings(since)
	if err != nil {
		return err
	}

	if len(activities) == 0 {
		log.Println("No activities to backfill")
		return nil
	}

	batchSize := 100
	processed := 0

	for i := 0; i < len(activities); i += batchSize {
		// Check for cancellation
		select {
		case <-ctx.Done():
			log.Printf("Backfill cancelled after %d/%d activities", processed, len(activities))
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(activities) {
			end = len(activities)
		}

		batch := activities[i:end]
		for _, act := range batch {
			embCtx := &EmbeddingContext{
				AppName:     act.AppName,
				WindowTitle: act.WindowTitle,
			}
			embedding := s.GenerateEmbedding(embCtx)
			contextText := BuildContextText(embCtx)
			contextHash := storage.HashContext(contextText)

			if err := s.store.SaveEmbedding(
				"screenshot", // event type matches the screenshots table
				act.ID,
				FloatsToBytes(embedding),
				contextText,
				contextHash,
			); err != nil {
				log.Printf("Failed to save embedding for activity %d: %v", act.ID, err)
				continue
			}
			processed++
		}

		log.Printf("Backfilled %d/%d activities", processed, len(activities))
	}

	log.Printf("Embedding backfill complete: %d activities processed", processed)
	return nil
}
