package worker

import (
	"context"
	"testing"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestPRMonitorWorker_GetInterval(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    settingsSvc := &service.SettingsServer{DB: db}
    sessionSvc := &service.SessionServer{DB: db}
    workerCtx := NewPRMonitorWorker(db, settingsSvc, sessionSvc)
    ctx := context.Background()
    
    // Default 60
    assert.Equal(t, 60*time.Second, workerCtx.getInterval(ctx))
    
    // Update PrStatusPollInterval
    _, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
        Settings: &pb.Settings{
            ProfileId: "default",
            PrStatusPollInterval: 90,
        },
    })
    assert.NoError(t, err)
    
    assert.Equal(t, 90*time.Second, workerCtx.getInterval(ctx))
}
