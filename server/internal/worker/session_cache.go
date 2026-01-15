package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
)

type SessionCacheWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
}

func NewSessionCacheWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer) *SessionCacheWorker {
	return &SessionCacheWorker{
		BaseWorker: BaseWorker{
			NameStr:  "SessionCacheWorker",
			Interval: 60 * time.Second, // Default, dynamic based on settings
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
	}
}

func (w *SessionCacheWorker) Start(ctx context.Context) error {
	logger.Info("%s starting...", w.Name())
	for {
		interval := w.getInterval(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s check failed: %s", w.Name(), err.Error())
			}
		}
	}
}

func (w *SessionCacheWorker) getInterval(ctx context.Context) time.Duration {
    // This worker's interval logic is complex in TS (per session).
    // In Go, we'll run a loop that checks ALL sessions and decides if they need update.
    // So we run frequently (e.g. every minute) and rely on 'LastUpdated' timestamp in DB to filter.
    return 60 * time.Second
}

func (w *SessionCacheWorker) runCheck(ctx context.Context) error {
	settings, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	// Logic from session-service.ts: syncStaleSessions
    // Iterate all sessions, check age vs thresholds (InProgressInteral, etc.)
    
    // We can optimize with SQL to fetch only stale sessions.
    // Or iterate all. TS iterates all.
    // Let's iterate all for simplicity, or use SQL if possible.
    // SQL: "SELECT id, state, last_updated, create_time, outputs FROM sessions"
    
    // Note: 'outputs' needed to check PR merged status.
    
    rows, err := w.db.QueryContext(ctx, "SELECT id, state, last_updated, create_time FROM sessions")
    if err != nil { return err }
    defer rows.Close()
    
    now := time.Now()
    var sessionsToUpdate []string
    
    for rows.Next() {
        var id, state string
        var lastUpdated int64
        var createTime string
        // var outputsJSON sql.NullString
        
        if err := rows.Scan(&id, &state, &lastUpdated, &createTime); err != nil {
             logger.Error("Scan failed: %v", err)
             continue
        }
        
        lastUpdate := time.UnixMilli(lastUpdated)
        age := now.Sub(lastUpdate)
        
        // Creation Time parsing
        ctime, _ := time.Parse(time.RFC3339, createTime)
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
        
        logger.Info("Session %s: Age %.2fs, Interval %d, State %s -> Update: %v", id, age.Seconds(), interval, state, shouldUpdate)
        
        if shouldUpdate {
            sessionsToUpdate = append(sessionsToUpdate, id)
        }
    }
    
	"fmt"
	"net/http"
	"os"
	"encoding/json"
	"io"
)

// ... existing imports ...

// ... existing struct/New ...

func (w *SessionCacheWorker) syncSession(ctx context.Context, id string) error {
	apiKey := os.Getenv("JULES_API_KEY")
	if apiKey == "" {
		// Log once or assume managed elsewhere if missing?
		// For now, fail silently or log warn?
		return fmt.Errorf("JULES_API_KEY not set")
	}

	url := fmt.Sprintf("https://jules.googleapis.com/v1alpha/sessions/%s", id)
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil { return err }

	req.Header.Set("X-Goog-Api-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("remote sync failed %d: %s", resp.StatusCode, string(b))
	}

	var remoteSess struct {
		State      string `json:"state"`
		UpdateTime string `json:"updateTime"`
		// Add other fields if needed
	}
	if err := json.NewDecoder(resp.Body).Decode(&remoteSess); err != nil {
		return err
	}

	// Update DB
	// We update state, update_time, and last_updated (to now, so we don't sync again immediately)
	now := time.Now().UnixMilli()
	
	_, err = w.db.ExecContext(ctx, "UPDATE sessions SET state = ?, update_time = ?, last_updated = ? WHERE id = ?", 
		remoteSess.State, remoteSess.UpdateTime, now, id)
	
	return err
}

func (w *SessionCacheWorker) runCheck(ctx context.Context) error {
	settings, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

    // ... (fetch logic same as before) ...
    rows, err := w.db.QueryContext(ctx, "SELECT id, state, last_updated, create_time FROM sessions")
    if err != nil { return err }
    defer rows.Close()
    
    now := time.Now()
    var sessionsToUpdate []string
    
    for rows.Next() {
        var id, state string
        var lastUpdated int64
        var createTime string
        
        if err := rows.Scan(&id, &state, &lastUpdated, &createTime); err != nil {
             logger.Error("Scan failed: %v", err)
             continue
        }
        
        lastUpdate := time.UnixMilli(lastUpdated)
        age := now.Sub(lastUpdate)
        
        // Creation Time parsing
        ctime, _ := time.Parse(time.RFC3339, createTime)
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
             if err := w.syncSession(ctx, id); err != nil {
                 logger.Error("%s: Failed to sync session %s: %s", w.Name(), id, err.Error())
             } else {
                 logger.Info("%s: Successfully synced session %s", w.Name(), id)
             }
        }
    }
    
	return nil
}
