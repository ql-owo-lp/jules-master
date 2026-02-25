package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/config"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

type AutoContinueWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
	fetcher         SessionFetcher
	apiKey          string
	id              string
}

func NewAutoContinueWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer, fetcher SessionFetcher, apiKey string) *AutoContinueWorker {
	return &AutoContinueWorker{
		BaseWorker: BaseWorker{
			NameStr:  "AutoContinueWorker",
			Interval: 60 * time.Second,
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		fetcher:         fetcher,
		apiKey:          apiKey,
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
		if s.GetAutoApprovalInterval() > 0 {
			return time.Duration(s.GetAutoApprovalInterval()) * time.Second
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

	cannedResponse := "you are independent principal software engineer, you are doing good, I trust your judgement, please continue. If you do it correctly in the first run, I will offer you a great peer bonus"
	if s.GetAutoContinueMessage() != "" {
		cannedResponse = s.GetAutoContinueMessage()
	}

	// 1. Discovery Phase
	var allSessionIDs []string
	threeDaysAgo := time.Now().AddDate(0, 0, -3).Format(time.RFC3339)

	if s.GetAutoContinueAllSessions() {
		// Discover ALL completed sessions from last 3 days
		rows, err := w.db.QueryContext(ctx, "SELECT id FROM sessions WHERE state = 'COMPLETED' AND create_time >= ?", threeDaysAgo)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err == nil {
				allSessionIDs = append(allSessionIDs, id)
			}
		}
		rows.Close()
	} else {
		// Discover sessions only from JOBS
		rows, err := w.db.QueryContext(ctx, "SELECT session_ids FROM jobs WHERE created_at >= ?", threeDaysAgo)
		if err != nil {
			return err
		}
		defer rows.Close()
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
	}

	if len(allSessionIDs) == 0 {
		return nil
	}

	for _, sessID := range allSessionIDs {
		// Local check first to avoid unnecessary API calls
		var state string
		err := w.db.QueryRowContext(ctx, "SELECT state FROM sessions WHERE id = ?", sessID).Scan(&state)
		if err != nil || state != "COMPLETED" {
			continue
		}

		// Fetch remote session
		if w.fetcher == nil {
			logger.Error("%s [%s]: No fetcher configured", w.Name(), w.id)
			continue
		}

		var remoteSess *RemoteSession
		var fetchErr error

		apiKeys := config.GetAllAPIKeys()
		if len(apiKeys) == 0 && w.apiKey != "" {
			apiKeys = []string{w.apiKey}
		} else if len(apiKeys) == 0 {
			if w.apiKey != "" {
				apiKeys = []string{w.apiKey}
			}
		}

		for _, key := range apiKeys {
			remoteSess, fetchErr = w.fetcher.GetSession(ctx, sessID, key)
			if fetchErr == nil && remoteSess != nil {
				break
			}
		}

		if fetchErr != nil || remoteSess == nil {
			logger.Error("%s [%s]: Failed to fetch remote session %s with any key: %v", w.Name(), w.id, sessID, fetchErr)
			continue
		}

		// Check for PR
		hasPR := false
		for _, output := range remoteSess.Outputs {
			if output.PullRequest != nil && output.PullRequest.Url != "" {
				hasPR = true
				break
			}
		}

		if hasPR {
			continue
		}

		// Check messages
		if len(remoteSess.Messages) > 0 {
			lastMsg := remoteSess.Messages[len(remoteSess.Messages)-1]
			// Avoid loop: if last message is EXACTLY our canned response, skip.
			if lastMsg.Text == cannedResponse {
				continue
			}
		}

		// Security: Prevent infinite loop of auto-continue messages
		cannedCount := 0
		for _, m := range remoteSess.Messages {
			if m.Text == cannedResponse {
				cannedCount++
			}
		}

		if cannedCount >= 5 {
			logger.Warn("%s [%s]: Session %s has reached max auto-continue limit (5). Skipping.", w.Name(), w.id, sessID)
			continue
		}

		// Send Continue Message
		logger.Info("%s [%s]: Auto-replying to session %s (Completed, No PR)", w.Name(), w.id, sessID)
		_, err = w.sessionService.SendMessage(ctx, &pb.SendMessageRequest{
			Id:      sessID,
			Message: cannedResponse,
		})
		if err != nil {
			logger.Error("%s [%s]: Failed to send message to session %s: %v", w.Name(), w.id, sessID, err)
		}
	}

	return nil
}
