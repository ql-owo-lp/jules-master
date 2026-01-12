package worker

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

type MonitorWorker struct {
	db *sqlx.DB
}

func NewMonitorWorker(d *sqlx.DB) *MonitorWorker {
	return &MonitorWorker{db: d}
}

func (w *MonitorWorker) Start(ctx context.Context) {
	log.Info().Msg("Starting MonitorWorker")
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.monitorPRs(ctx)
		}
	}
}

func (w *MonitorWorker) monitorPRs(ctx context.Context) {
	// Logic to check PR status for active sessions
	// Placeholder
}
