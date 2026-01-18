package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"os"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/gen"
	gclient "github.com/mcpany/jules/internal/github"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
)

type AutoRetryWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
	id              string
}

func NewAutoRetryWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer) *AutoRetryWorker {
	return &AutoRetryWorker{
		BaseWorker: BaseWorker{
			NameStr:  "AutoRetryWorker",
			Interval: 60 * time.Second,
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		id:              uuid.New().String()[:8],
	}
}

func (w *AutoRetryWorker) Start(ctx context.Context) error {
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

func (w *AutoRetryWorker) getInterval(ctx context.Context) time.Duration {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err == nil {
		if s.AutoApprovalInterval > 0 {
			return time.Duration(s.AutoApprovalInterval) * time.Second
		}
	}
	return 60 * time.Second
}

func (w *AutoRetryWorker) runCheck(ctx context.Context) error {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	if !s.AutoRetryEnabled {
		return nil
	}

	// Logic:
	// 1. Get failed sessions or completed sessions with failed PR checks.
	// 2. Retry with message.

	// Simplified query for candidates
	// Active jobs last 3 days
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

	token := os.Getenv("GITHUB_TOKEN")
	var gh *gclient.Client
	if token != "" {
		gh = gclient.NewClient(token)
	}

	for _, sessID := range allSessionIDs {
		var state string
		// We really need outputs to check PR url...
		// For now, let's assume if FAILED we retry.
		err := w.db.QueryRowContext(ctx, "SELECT state FROM sessions WHERE id = ?", sessID).Scan(&state)
		if err != nil {
			continue
		}

		if state == "FAILED" {
			// Check if already retried
			// ... (Activity check skipped for brevity, but crucial for spam prevention)

			// logger.Info("%s: Retrying session %s", w.Name(), sessID)
			// w.sessionService.SendMessage(...)
		} else if state == "COMPLETED" && gh != nil {
			// Check outputs for PR
			// We need to fetch session details with outputs
			// Not available in simple query.
			// ...
			// Logic: Parse PR URL, Check Status.
			// If failed, send message.

			// Stubbing content:
			// url := ...
			// owner, repo, ref := parse(url)
			// status, err := gh.GetCombinedStatus(ctx, owner, repo, ref)
			// if status.State == "failure" { ... }
		}
	}

	return nil
}

// Stub parsing helper
// func parsePRUrl(url string) (string, string, string) {
//    // ...
//    return "", "", ""
// }
