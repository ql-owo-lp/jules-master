package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
)

type BackgroundJobWorker struct {
	BaseWorker
	db          *sql.DB
	jobService  *service.JobServer
	sessionService *service.SessionServer
}

func NewBackgroundJobWorker(database *sql.DB, jobService *service.JobServer, sessionService *service.SessionServer) *BackgroundJobWorker {
	return &BackgroundJobWorker{
		BaseWorker: BaseWorker{
			NameStr:  "BackgroundJobWorker",
			Interval: 10 * time.Second, // Poll frequently
		},
		db:             database,
		jobService:     jobService,
		sessionService: sessionService,
	}
}

func (w *BackgroundJobWorker) Start(ctx context.Context) error {
	logger.Info("Starting worker: %s", w.Name())
	
	// Ensure we don't start immediately to avoid startup clashes? No, it's fine.
    
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(w.Interval):
			if err := w.ProcessJobs(ctx); err != nil {
				logger.Error("Worker %s failed: %s", w.Name(), err.Error())
			}
		}
	}
}

func (w *BackgroundJobWorker) ProcessJobs(ctx context.Context) error {
    // Find PENDING jobs
    rows, err := w.db.QueryContext(ctx, "SELECT id, session_count FROM jobs WHERE status = 'PENDING' LIMIT 5") // Limit concurrency
    if err != nil {
        return err
    }
    defer rows.Close()

    type PendingJob struct {
        ID string
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
    
    logger.Info("%s: Found %d pending jobs", w.Name(), len(jobs))

    for _, job := range jobs {
        w.processJob(ctx, job.ID, job.SessionCount)
    }

    return nil
}

func (w *BackgroundJobWorker) processJob(ctx context.Context, jobID string, sessionCount int) {
    logger.Info("%s: Processing job %s", w.Name(), jobID)
    
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
            Name: "", // will be auto generated
            Prompt: job.Prompt,
            Repo: job.Repo,
            Branch: job.Branch,
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
         logger.Info("%s: Job %s completed with status %s", w.Name(), jobID, status)
    }
}
