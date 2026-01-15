package worker

import (
	"context"
	"database/sql"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
)

type PRMonitorWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
    sessionService  *service.SessionServer
}

func NewPRMonitorWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer) *PRMonitorWorker {
	return &PRMonitorWorker{
		BaseWorker: BaseWorker{
			NameStr:  "PRMonitorWorker",
			Interval: 60 * time.Second,
		},
		db:              database,
		settingsService: settingsService,
        sessionService: sessionService,
	}
}

func (w *PRMonitorWorker) Start(ctx context.Context) error {
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

func (w *PRMonitorWorker) getInterval(ctx context.Context) time.Duration {
    s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
    if err == nil {
        if s.PrStatusPollInterval > 0 {
             return time.Duration(s.PrStatusPollInterval) * time.Second
        }
    }
    return 60 * time.Second
}

func (w *PRMonitorWorker) runCheck(ctx context.Context) error {
    _, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
    if err != nil { return err }
    
    // Check failing actions
    // checkFailingActions := s.CheckFailingActionsEnabled 
    
    // We need to find sessions/jobs that have PRs.
    // Query sessions with outputs containing 'pullRequest'
    // This requires JSON query or checking all sessions.
    // For efficiency, maybe we should track active PRs?
    // TS implementation likely iterates recent sessions.
    
    // Simplified approach: scan recent sessions for outputs.
    // Ideally we'd have a PRs table or column.
    
    // Using same 3 days window logic or active sessions.
    // Assuming we scan sessions updated recently.
    
    // To port faithfully without too much complexity:
    // 1. Get token
    // 2. Iterate sessions
    // 3. Check PR status via GitHub API
    // 4. Send message if checks failed
    
    // Stub for now as it's complex logic portability
    // logger.Info("%s: Checking PRs...", w.Name())
    
    return nil
}
