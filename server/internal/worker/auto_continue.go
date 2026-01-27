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

type AutoContinueWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
	id              string
}

func NewAutoContinueWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer) *AutoContinueWorker {
	return &AutoContinueWorker{
		BaseWorker: BaseWorker{
			NameStr:  "AutoContinueWorker",
			Interval: 60 * time.Second,
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		id:              uuid.New().String()[:8],
	}
}

func (w *AutoContinueWorker) Start(ctx context.Context) error {
	logger.Info("%s [%s] starting...", w.Name(), w.id)

	for {
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

func (w *AutoContinueWorker) getInterval(ctx context.Context) time.Duration {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err == nil {
		if s.AutoApprovalInterval > 0 {
			// Reusing auto approval interval logic from TS?
			// TS uses `settingsResult[0].autoApprovalInterval` as fallback interval for auto continue check
			return time.Duration(s.AutoApprovalInterval) * time.Second
		}
	}
	return 60 * time.Second
}

func (w *AutoContinueWorker) runCheck(ctx context.Context) error {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	if !s.GetAutoContinueEnabled() {
		return nil
	}

	// Logic:
	// 1. Get recently started jobs (last 3 days)
	// 2. Get session IDs
	// 3. Check session status (COMPLETED) and outputs (no PR)
	// 4. Send continue message

	// SQLite: created_at is usually RFC3339 string.
	threeDaysAgo := time.Now().AddDate(0, 0, -3).Format(time.RFC3339)

	rows, err := w.db.QueryContext(ctx, "SELECT session_ids FROM jobs WHERE created_at >= ?", threeDaysAgo)
	if err != nil {
		return err
	}
	defer rows.Close()

	var allSessionIDs []string
	for rows.Next() {
		var idsJSON string
		if err := rows.Scan(&idsJSON); err == nil {
			var ids []string
			if err := json.Unmarshal([]byte(idsJSON), &ids); err == nil {
				allSessionIDs = append(allSessionIDs, ids...)
			}
		}
	}
	rows.Close()

	if len(allSessionIDs) == 0 {
		return nil
	}

	// Check sessions
	// Need to batch get? For now simple loop or IN clause
	// Construct IN clause
	// SQLite limit on variables... handle efficiently or simplified loop.
	// Loop is safer for variable limit.

	for _, sessID := range allSessionIDs {
		// Fetch session status and output
		// Need to query DB
		var state string
		// var outputsJSON sql.NullString

		err := w.db.QueryRowContext(ctx, "SELECT state FROM sessions WHERE id = ?", sessID).Scan(&state)
		if err != nil {
			continue
		}

		if state == "COMPLETED" {
			// Check outputs for PR
			// We need outputs column.
			// SELECT outputs FROM sessions ...
			// Assuming outputs is stored in sessions table or separate?
			// Proto has 'outputs' in Session message.

			// TODO: Check PR existence in outputs
			// TODO: Check if we already sent continue message

			// If eligible:
			// logger.Info("%s: Sending continue message to session %s", w.Name(), sessID)
			// w.sessionService.SendMessage(ctx, &pb.SendMessageRequest{...})
			// We need SendMessage RPC.
		}
	}

	return nil
}
