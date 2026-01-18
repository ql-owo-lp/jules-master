package worker

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	"github.com/robfig/cron/v3"
)

type CronWorker struct {
	BaseWorker
	id             string
	db             *sql.DB
	cronJobService *service.CronJobServer
	jobService     *service.JobServer
	parser         cron.Parser
}

func NewCronWorker(database *sql.DB, cronJobService *service.CronJobServer, jobService *service.JobServer) *CronWorker {
	return &CronWorker{
		BaseWorker: BaseWorker{
			NameStr:  "CronWorker",
			Interval: 60 * time.Second,
		},
		id:             uuid.New().String()[:8],
		db:             database,
		cronJobService: cronJobService,
		jobService:     jobService,
		parser:         cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow),
	}
}

func (w *CronWorker) Start(ctx context.Context) error {
	logger.Info("%s [%s] starting...", w.Name(), w.id)

	for {
		interval := w.Interval
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			status := "Success"
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s [%s] check failed: %s", w.Name(), w.id, err.Error())
				status = "Failed"
			}
			nextRun := time.Now().Add(interval)
			logger.Info("%s [%s] task completed. Status: %s. Next run at %s", w.Name(), w.id, status, nextRun.Format(time.RFC3339))
		}
	}
}

func (w *CronWorker) runCheck(ctx context.Context) error {
	// List all enabled cron jobs
	// We can't easily filter by "due" in SQL without stored proc, so fetch all enabled.
	// If list is huge this is bad, but for now it's fine.

	// We'll query DB directly or use service if it exposes internal list.
	// Service ListCronJobs returns all.

	// Direct DB query is better to filter 'enabled'
	rows, err := w.db.QueryContext(ctx, "SELECT id, name, schedule, prompt, repo, branch, last_run_at, created_at, auto_approval, automation_mode, require_plan_approval, session_count, profile_id FROM cron_jobs WHERE enabled = 1")
	if err != nil {
		return err
	}
	defer rows.Close()

	now := time.Now()
	var jobsToTrigger []*pb.CronJob

	for rows.Next() {
		var c pb.CronJob
		var lastRunAt sql.NullString
		var createdAt string
		var automationMode sql.NullString // Enum stored as string probably? Or int?
		// Proto uses string for modes in some places, int in others?
		// In DB schema it is TEXT.
		// Let's decode carefully.

		err := rows.Scan(
			&c.Id, &c.Name, &c.Schedule, &c.Prompt, &c.Repo, &c.Branch,
			&lastRunAt, &createdAt, &c.AutoApproval, &automationMode,
			&c.RequirePlanApproval, &c.SessionCount, &c.ProfileId,
		)
		if err != nil {
			logger.Error("%s [%s]: scan error: %v", w.Name(), w.id, err)
			continue
		}

		// Parse Schedule
		schedule, err := w.parser.Parse(c.Schedule)
		if err != nil {
			logger.Error("%s [%s]: invalid schedule for job %s: %v", w.Name(), w.id, c.Id, err)
			continue
		}

		// Determine last run time
		var lastRunTime time.Time
		if lastRunAt.Valid && lastRunAt.String != "" {
			lastRunTime, _ = time.Parse(time.RFC3339, lastRunAt.String)
		} else {
			lastRunTime, _ = time.Parse(time.RFC3339, createdAt)
		}

		// Calculate next run time from last run
		nextRun := schedule.Next(lastRunTime)
		logger.Info("%s [%s]: Cron %s: LastRun %v, Next %v, Now %v", w.Name(), w.id, c.Name, lastRunTime, nextRun, now)

		// If nextRun is in the past, it's due.
		if nextRun.Before(now) {
			logger.Info("%s [%s]: Job %s (%s) is due (Next: %v, Now: %v)", w.Name(), w.id, c.Name, c.Id, nextRun, now)
			jobsToTrigger = append(jobsToTrigger, &c)
		}
	}
	rows.Close()

	for _, c := range jobsToTrigger {
		// Trigger Job
		newJobId := uuid.New().String()

		jobReq := &pb.CreateJobRequest{
			Id:                  newJobId,
			Name:                c.Name,
			Repo:                c.Repo,
			Branch:              c.Branch,
			AutoApproval:        c.AutoApproval,
			Background:          true,
			Prompt:              c.Prompt,
			SessionCount:        c.SessionCount,
			Status:              "PENDING",
			RequirePlanApproval: c.RequirePlanApproval,
			CronJobId:           c.Id,
			ProfileId:           c.ProfileId,
		}

		_, err := w.jobService.CreateJob(ctx, jobReq)
		if err != nil {
			logger.Error("%s [%s]: Failed to create job for cron %s: %v", w.Name(), w.id, c.Id, err)
			continue
		}

		// Update LastRunAt
		_, err = w.db.ExecContext(ctx, "UPDATE cron_jobs SET last_run_at = ? WHERE id = ?", now.Format(time.RFC3339), c.Id)
		if err != nil {
			logger.Error("%s [%s]: Failed to update last_run_at for cron %s: %v", w.Name(), w.id, c.Id, err)
		}

		logger.Info("%s [%s]: Triggered job %s for cron %s", w.Name(), w.id, newJobId, c.Id)
	}

	return nil
}
