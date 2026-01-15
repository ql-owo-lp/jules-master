package worker

import (
	"context"
	"testing"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestAutoDeleteStaleBranchWorker_GetInterval(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    settingsSvc := &service.SettingsServer{DB: db}
    workerCtx := NewAutoDeleteStaleBranchWorker(db, settingsSvc)
    ctx := context.Background()
    
    // Default disabled
    // settings default has auto_delete_stale_branches = false (0)
   
    // Check interval when disabled -> 1 hour
    assert.Equal(t, 1*time.Hour, workerCtx.getInterval(ctx))
    
    // Enable
    _, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
        Settings: &pb.Settings{
            ProfileId: "default",
            AutoDeleteStaleBranches: true,
        },
    })
    assert.NoError(t, err)
    
    // Check interval when enabled -> 24 hours
    assert.Equal(t, 24*time.Hour, workerCtx.getInterval(ctx))
}

func TestAutoDeleteStaleBranchWorker_RunCheck_Disabled(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    settingsSvc := &service.SettingsServer{DB: db}
    workerCtx := NewAutoDeleteStaleBranchWorker(db, settingsSvc)
    ctx := context.Background()
    
    // Disabled by default
    err := workerCtx.runCheck(ctx)
    assert.NoError(t, err)
    // Should do nothing (no GitHub calls)
}
