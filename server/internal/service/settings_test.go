package service

import (
	"context"
	"strings"
	"testing"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestSettingsService_GetUpdate(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SettingsServer{DB: db}
	ctx := context.Background()

	// Get default
	def, err := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	assert.Equal(t, int32(300), def.IdlePollInterval)

	// Update
	def.IdlePollInterval = 300
	_, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: def})
	if err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	// Get updated
	got, err := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	assert.NoError(t, err)
	assert.Equal(t, int32(300), got.IdlePollInterval)

	// Update again (cover UPDATE path)
	got.IdlePollInterval = 600
	_, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: got})
	assert.NoError(t, err)

	got2, err := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	assert.NoError(t, err)
	assert.Equal(t, int32(600), got2.IdlePollInterval)

	// Error path
	_, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: nil})
	assert.Error(t, err)
}

func TestSettingsService_Validation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SettingsServer{DB: db}
	ctx := context.Background()

	base, _ := svc.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})

	// Test 1: Invalid Theme
	invalidTheme := *base
	invalidTheme.Theme = "hacker-green"
	_, err := svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: &invalidTheme})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid theme")

	// Test 2: Invalid AutoMergeMethod
	invalidMerge := *base
	invalidMerge.AutoMergeMethod = "force-push"
	_, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: &invalidMerge})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid auto merge method")

	// Test 3: Message too long
	longMsg := *base
	longMsg.AutoRetryMessage = strings.Repeat("a", 1001)
	_, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: &longMsg})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "too long")

	// Test 4: Negative interval
	negInterval := *base
	negInterval.IdlePollInterval = -1
	_, err = svc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{Settings: &negInterval})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "must be positive")
}
