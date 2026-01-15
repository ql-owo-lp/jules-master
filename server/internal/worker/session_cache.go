package worker

import (
	"context"
	"database/sql"
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
    
    // Update sessions
    // In a real implementation we would call upstream API. 
    // Since we ARE the server, and the upstream is "Jules API" (Google?), 
    // We assume we are proxying?
    // If we are replacing the Node backend which proxied to Google, then YES we need to proxy.
    // But `fetch-client` in Node hits `jules.googleapis.com`.
    // My Go backend doesn't have a Google API client yet.
    // Creating one is out of scope for "porting worker tests" unless I am porting the worker functionality entirely.
    // I am porting functionality.
    // So I need a way to fetch from upstream.
    // I'll leave a TODO or simple log for now as I don't have the API key or client setup here.
    // Actually, `AutoContinue` uses `SendMessage` which likely hits Upstream.
    
    if len(sessionsToUpdate) > 0 {
        logger.Info("%s: Identified %d sessions to sync (stubbed)", w.Name(), len(sessionsToUpdate))
        // Stub: Update last_updated to prevent loop
        for _, id := range sessionsToUpdate {
             w.db.ExecContext(ctx, "UPDATE sessions SET last_updated = ? WHERE id = ?", now.UnixMilli(), id)
        }
    }
    
	return nil
}
