package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"

	"github.com/mcpany/jules/internal/config"
)

// SessionSyncer defines the interface for syncing sessions
type SessionSyncer interface {
	SyncSession(ctx context.Context, id string) error
}

type HTTPSessionSyncer struct {
	DB      *sql.DB
	BaseURL string // Optional override for testing
}

func (s *HTTPSessionSyncer) SyncSession(ctx context.Context, id string) error {
	apiKeys := config.GetAllAPIKeys()
	if len(apiKeys) == 0 {
		return fmt.Errorf("JULES_API_KEYs not set")
	}

	var lastErr error
	for _, apiKey := range apiKeys {
		if err := s.syncSessionWithKey(ctx, id, apiKey); err != nil {
			lastErr = err
			// If 404, valid content but not found, maybe invalid key for that specific session if sessions are sharded?
			// Actually session ID should be globally unique or 404.
			// If 403/401, definitely try next key.
			// If 404, checking other keys might help if keys see different scopes (unlikely for Jules API but possible).
			// We'll continue on error.
			continue
		}
		// Success
		return nil
	}
	return fmt.Errorf("failed to sync session %s with any API key: %v", id, lastErr)
}

func (s *HTTPSessionSyncer) syncSessionWithKey(ctx context.Context, id, apiKey string) error {
	baseURL := "https://jules.googleapis.com/v1alpha"
	if s.BaseURL != "" {
		baseURL = s.BaseURL
	}
	url := fmt.Sprintf("%s/sessions/%s", baseURL, id)
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("X-Goog-Api-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("remote sync failed %d: %s", resp.StatusCode, string(b))
	}

	var remoteSess struct {
		State      string `json:"state"`
		UpdateTime string `json:"updateTime"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&remoteSess); err != nil {
		return err
	}

	// Update DB
	now := time.Now().UnixMilli()
	_, err = s.DB.ExecContext(ctx, "UPDATE sessions SET state = ?, update_time = ?, last_updated = ? WHERE id = ?",
		remoteSess.State, remoteSess.UpdateTime, now, id)

	return err
}

type SessionCacheWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
	syncer          SessionSyncer
}

func NewSessionCacheWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer) *SessionCacheWorker {
	return &SessionCacheWorker{
		BaseWorker: BaseWorker{
			NameStr:  "SessionCacheWorker",
			Interval: 60 * time.Second,
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		syncer:          &HTTPSessionSyncer{DB: database},
	}
}

// Allow injecting a mock syncer for testing
func (w *SessionCacheWorker) SetSyncer(syncer SessionSyncer) {
	w.syncer = syncer
}

func (w *SessionCacheWorker) Start(ctx context.Context) error {
	logger.Info("%s starting...", w.Name())
	for {
		interval := w.getInterval(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			status := "Success"
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s check failed: %s", w.Name(), err.Error())
				status = "Failed"
			}
			nextInterval := w.getInterval(ctx)
			nextRun := time.Now().Add(nextInterval)
			logger.Info("%s task completed. Status: %s. Next run at %s", w.Name(), status, nextRun.Format(time.RFC3339))
		}
	}
}

func (w *SessionCacheWorker) getInterval(ctx context.Context) time.Duration {
	return 60 * time.Second
}

func (w *SessionCacheWorker) runCheck(ctx context.Context) error {
	// ... logic remains same, just calls w.syncer.SyncSession(ctx, id) ...
	settings, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	rows, err := w.db.QueryContext(ctx, "SELECT id, state, last_updated, create_time FROM sessions")
	if err != nil {
		return err
	}
	defer rows.Close()

	now := time.Now()
	var sessionsToUpdate []string

	for rows.Next() {
		var id, state string
		var lastUpdated int64
		var createTime sql.NullString

		if err := rows.Scan(&id, &state, &lastUpdated, &createTime); err != nil {
			logger.Error("Scan failed: %v", err)
			continue
		}

		lastUpdate := time.UnixMilli(lastUpdated)
		age := now.Sub(lastUpdate)

		ctime, _ := time.Parse(time.RFC3339, createTime.String)
		daysSinceCreation := now.Sub(ctime).Hours() / 24

		if daysSinceCreation > float64(settings.SessionCacheMaxAgeDays) {
			continue
		}

		shouldUpdate := false
		interval := settings.SessionCachePendingApprovalInterval

		switch state {
		case "IN_PROGRESS", "PLANNING", "QUEUED":
			interval = settings.SessionCacheInProgressInterval
		case "AWAITING_PLAN_APPROVAL", "AWAITING_USER_FEEDBACK":
			interval = settings.SessionCachePendingApprovalInterval
		case "COMPLETED":
			interval = settings.SessionCacheCompletedNoPrInterval
		}

		if age > time.Duration(interval)*time.Second {
			shouldUpdate = true
		}

		if shouldUpdate {
			sessionsToUpdate = append(sessionsToUpdate, id)
		}
	}
	rows.Close()

	if len(sessionsToUpdate) > 0 {
		logger.Info("%s: Syncing %d sessions", w.Name(), len(sessionsToUpdate))
		for _, id := range sessionsToUpdate {
			if err := w.syncer.SyncSession(ctx, id); err != nil {
				logger.Error("%s: Failed to sync session %s: %s", w.Name(), id, err.Error())
			} else {
				logger.Info("%s: Successfully synced session %s", w.Name(), id)
			}
		}
	}

	return nil
}

// Remove old syncSession method since functionality is moved to HTTPSessionSyncer
