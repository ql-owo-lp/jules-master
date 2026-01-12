package worker

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/jules-org/jules/backend/pkg/db"
	"github.com/rs/zerolog/log"
)

type BackgroundJobWorker struct {
	db *sqlx.DB
}

func NewBackgroundJobWorker(d *sqlx.DB) *BackgroundJobWorker {
	return &BackgroundJobWorker{db: d}
}

func (w *BackgroundJobWorker) Start(ctx context.Context) {
	log.Info().Msg("Starting BackgroundJobWorker")
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.processPendingJobs(ctx)
		}
	}
}

func (w *BackgroundJobWorker) processPendingJobs(ctx context.Context) {
	// Acquire lock logic should go here if multiple replicas run
	// For now, simple implementation
	
	var jobs []db.Job
	err := w.db.SelectContext(ctx, &jobs, "SELECT * FROM jobs WHERE status IN ('PENDING', 'PROCESSING')")
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch pending jobs")
		return
	}

	for _, job := range jobs {
		w.processJob(ctx, job)
	}
}

func (w *BackgroundJobWorker) processJob(ctx context.Context, job db.Job) {
	log.Info().Str("job_id", job.ID).Msg("Processing job")
	
	// Implementation logic:
	// 1. Fetch Source (using GitHub client or whatever)
	// 2. Create Sessions loop
	// 3. Update Job status

	// This logic requires interacting with external APIs (GitHub, Jules API if we still use it, or direct logic).
	// Since we are now the backend, we probably should call the internal SessionService logic directly or via internal method?
	// But `SessionService` is currently just DB wrapper.
	// The Node app `createSession` called `jules.googleapis.com`. 
	// **CRITICAL**: The text says "Now the frontend will use protobuf ... make sure you implemented enough test".
	// It assumes we are replacing the *Node backend*. 
	// Does the Node backend call `jules.googleapis.com`? Yes, `src/app/sessions/new/actions.ts` does.
	// So our Go backend must ALSO call `jules.googleapis.com` or replace it?
	// The prompt says "convert the backend to golang instead, so that all the backend jobs are executed by go server".
	// It implies the Node app *was* the backend (Next.js server actions).
	// But `createSession` in Node calls `jules.googleapis.com`.
	// Use `fetchWithRetry` to call `jules.googleapis.com`.
	// So we need to call that API from Go too.
	// We need an API client for Jules API in Go.
	
	// For now, I'll put a placeholder TODO and logic structure.
	
	// Update status to PROCESSING
	if job.Status.String != "PROCESSING" {
		w.db.ExecContext(ctx, "UPDATE jobs SET status = 'PROCESSING' WHERE id = ?", job.ID)
	}
	
	// ... Logic ...
}
