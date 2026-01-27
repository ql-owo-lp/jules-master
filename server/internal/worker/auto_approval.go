package worker

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

type AutoApprovalWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
	id              string
}

func NewAutoApprovalWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer) *AutoApprovalWorker {
	return &AutoApprovalWorker{
		BaseWorker: BaseWorker{
			NameStr:  "AutoApprovalWorker",
			Interval: 60 * time.Second, // Default fallback
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		id:              uuid.New().String()[:8],
	}
}

func (w *AutoApprovalWorker) Start(ctx context.Context) error {
	logger.Info("%s [%s] starting...", w.Name(), w.id)

	// Initial run
	if err := w.runCheck(ctx); err != nil {
		logger.Error("%s [%s] initial check failed: %s", w.Name(), w.id, err.Error())
	}

	for {
		// Calculate interval
		interval := w.getInterval(ctx)

		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			status := "Success"
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s [%s] check failed: %s", w.Name(), w.id, err.Error())
				status = "Failed"
			}
			nextInterval := w.getInterval(ctx)
			nextRun := time.Now().Add(nextInterval)
			logger.Info("%s [%s] task completed. Status: %s. Next run at %s", w.Name(), w.id, status, nextRun.Format(time.RFC3339))
		}
	}
}

func (w *AutoApprovalWorker) getInterval(ctx context.Context) time.Duration {
	// Default 60s
	interval := 60 * time.Second

	// Fetch settings for default profile
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err == nil {
		if s.AutoApprovalInterval > 0 {
			interval = time.Duration(s.AutoApprovalInterval) * time.Second
		}
	}

	if interval < 10*time.Second {
		interval = 10 * time.Second
	}
	return interval
}

func (w *AutoApprovalWorker) runCheck(ctx context.Context) error {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	if !s.GetAutoApprovalEnabled() {
		// Disabled
		return nil
	}

	// List sessions waiting for approval
	// Note: ListSessions in service implementation we made supports filtering by profile but not state directly in SQL yet.
	// Ideally we should update SessionService to support state filtering or use raw query here.
	// Using raw query for efficiency.

	rows, err := w.db.QueryContext(ctx, "SELECT id, update_time FROM sessions WHERE state = 'AWAITING_PLAN_APPROVAL'")
	if err != nil {
		return err
	}
	defer rows.Close()

	// 1. Collect candidates
	type candidate struct {
		id string
	}
	var candidates []candidate

	for rows.Next() {
		var id string
		var updateTime string // SQLite datetime string
		if err := rows.Scan(&id, &updateTime); err != nil {
			continue
		}
		candidates = append(candidates, candidate{id: id})
	}
	rows.Close()

	// 2. Filter and Approve
	var pendingIDs []string
	for _, c := range candidates {
		// FILTER: If NOT "All Sessions", check if this session belongs to a Job.
		if !s.GetAutoApprovalAllSessions() {
			var count int
			err := w.db.QueryRowContext(ctx, `SELECT count(*) FROM jobs WHERE session_ids LIKE ?`, "%"+c.id+"%").Scan(&count)
			if err != nil || count == 0 {
				continue
			}
		}
		pendingIDs = append(pendingIDs, c.id)
	}

	if len(pendingIDs) > 0 {
		logger.Info("%s [%s]: Found pending sessions: %d", w.Name(), w.id, len(pendingIDs))
		for _, id := range pendingIDs {
			logger.Info("%s [%s]: Approving session %s", w.Name(), w.id, id)
			_, err := w.sessionService.ApprovePlan(ctx, &pb.ApprovePlanRequest{Id: id})
			if err != nil {
				logger.Error("%s [%s]: Failed to approve session %s: %s", w.Name(), w.id, id, err.Error())
			}
		}
	}

	return nil
}
