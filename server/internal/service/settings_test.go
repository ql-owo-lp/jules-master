package service

import (
	"context"
	"testing"

	pb "github.com/mcpany/jules/gen"
	"github.com/stretchr/testify/assert"
)

func TestSettingsService_GetUpdate(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    svc := &SettingsServer{DB: db}
    ctx := context.Background()
    
    // Get default
    def, err := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
    if err != nil { t.Fatalf("GetSettings failed: %v", err) }
    assert.Equal(t, int32(120), def.IdlePollInterval)
    
    // Update
    def.IdlePollInterval = 300
    _, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: def})
    if err != nil { t.Fatalf("UpdateSettings failed: %v", err) }
    
    // Get updated
    got, err := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
    assert.NoError(t, err)
    assert.Equal(t, int32(300), got.IdlePollInterval)
}

func TestSettingsService_Validation(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    svc := &SettingsServer{DB: db}
    ctx := context.Background()

    // Get default
    def, err := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
    assert.NoError(t, err)

    // Invalid IdlePollInterval
    def.IdlePollInterval = 0
    _, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: def})
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "idle_poll_interval must be positive")

    // Reset
    def.IdlePollInterval = 120

    // Invalid Theme
    def.Theme = "hacker-green"
    _, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: def})
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "invalid theme")
}
