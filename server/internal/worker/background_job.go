package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

type BackgroundJobWorker struct {
	BaseWorker
	id             string
	db             *sql.DB
	jobService     *service.JobServer
	sessionService *service.SessionServer
	settingsSvc    *service.SettingsServer
}

func NewBackgroundJobWorker(database *sql.DB, jobService *service.JobServer, sessionService *service.SessionServer, settingsSvc *service.SettingsServer) *BackgroundJobWorker {
	return &BackgroundJobWorker{
		BaseWorker: BaseWorker{
			NameStr:  "BackgroundJobWorker",
			Interval: 300 * time.Second, // Default to 5 minutes
		},
		id:             uuid.New().String()[:8],
		db:             database,
		jobService:     jobService,
		sessionService: sessionService,
		settingsSvc:    settingsSvc,
	}
}

func (w *BackgroundJobWorker) Start(ctx context.Context) error {
	logger.Info("Starting worker: %s [%s]", w.Name(), w.id)

	for {
		interval := w.getInterval(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			status := "Success"
			if err := w.ProcessJobs(ctx); err != nil {
				logger.Error("Worker %s [%s] failed: %s", w.Name(), w.id, err.Error())
				status = "Failed"
			}
			nextRun := time.Now().Add(interval)
			logger.Info("%s [%s] task completed. Status: %s. Next run at %s", w.Name(), w.id, status, nextRun.Format(time.RFC3339))
		}
	}
}

func (w *BackgroundJobWorker) getInterval(ctx context.Context) time.Duration {
	s, err := w.settingsSvc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err == nil && s.IdlePollInterval > 0 {
		return time.Duration(s.IdlePollInterval) * time.Second
	}
	return w.Interval
}

func (w *BackgroundJobWorker) getMaxConcurrentWorkers(ctx context.Context) int32 {
	s, err := w.settingsSvc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err == nil && s.MaxConcurrentBackgroundWorkers > 0 {
		return s.MaxConcurrentBackgroundWorkers
	}
	return 5 // Default
}

func (w *BackgroundJobWorker) ProcessJobs(ctx context.Context) error {
	limit := w.getMaxConcurrentWorkers(ctx)
	// Find PENDING jobs
	rows, err := w.db.QueryContext(ctx, "SELECT id, session_count FROM jobs WHERE status = 'PENDING' LIMIT ?", limit)
	if err != nil {
		return err
	}
	defer rows.Close()

	type PendingJob struct {
		ID           string
		SessionCount int
	}
	var jobs []PendingJob

	for rows.Next() {
		var j PendingJob
		if err := rows.Scan(&j.ID, &j.SessionCount); err != nil {
			continue
		}
		jobs = append(jobs, j)
	}
	rows.Close() // Close early to allow updates

	if len(jobs) == 0 {
		return nil
	}

	logger.Info("%s [%s]: Found %d pending jobs", w.Name(), w.id, len(jobs))

	for _, job := range jobs {
		w.processJob(ctx, job.ID, job.SessionCount)
	}

	return nil
}

func (w *BackgroundJobWorker) processJob(ctx context.Context, jobID string, sessionCount int) {
	logger.Info("%s [%s]: Processing job %s", w.Name(), w.id, jobID)

	// Mark as running
	_, err := w.db.Exec("UPDATE jobs SET status = 'Running' WHERE id = ?", jobID)
	if err != nil {
		logger.Error("%s: Failed to update job %s to Running: %s", w.Name(), jobID, err.Error())
		return
	}

	// Fetch job details first
	job, err := w.jobService.GetJob(ctx, &pb.GetJobRequest{Id: jobID})
	if err != nil {
		logger.Error("%s: Failed to fetch job %s: %s", w.Name(), jobID, err.Error())
		return
	}

	// Create sessions
	var sessionIDs []string
	success := true

	for i := 0; i < sessionCount; i++ {
		// Create session
		sess, err := w.sessionService.CreateSession(ctx, &pb.CreateSessionRequest{
			Name:      "", // will be auto generated
			Prompt:    job.Prompt,
			Repo:      job.Repo,
			Branch:    job.Branch,
			ProfileId: job.ProfileId,
		})
		if err != nil {
			logger.Error("%s: Failed to create session for job %s: %s", w.Name(), jobID, err.Error())
			logger.Error("Job prompt: %s, Profile: %s", job.Prompt, job.ProfileId)
			success = false
			break
		}
		sessionIDs = append(sessionIDs, sess.Id)
	}

	// Update job with session IDs and status
	status := "Succeeded"
	if !success {
		status = "Failed"
	}

	sessionIDsJSON, _ := json.Marshal(sessionIDs)

	_, err = w.db.Exec("UPDATE jobs SET status = ?, session_ids = ? WHERE id = ?", status, string(sessionIDsJSON), jobID)
	if err != nil {
		logger.Error("%s: Failed to update job %s to %s: %s", w.Name(), jobID, status, err.Error())
	} else {
		logger.Info("%s [%s]: Job %s completed with status %s. Created sessions: %v", w.Name(), w.id, jobID, status, sessionIDs)
	}
}
