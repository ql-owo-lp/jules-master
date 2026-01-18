package worker

import (
	"context"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestAutoRetryWorker_GetInterval(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	settingsSvc := &service.SettingsServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewAutoRetryWorker(db, settingsSvc, sessionSvc)
	ctx := context.Background()

	// Default
	assert.Equal(t, 60*time.Second, workerCtx.getInterval(ctx))
}
