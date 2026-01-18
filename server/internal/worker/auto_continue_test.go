package worker

import (
	"context"
	"testing"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestAutoContinueWorker_GetInterval(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	settingsSvc := &service.SettingsServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewAutoContinueWorker(db, settingsSvc, sessionSvc)
	ctx := context.Background()

	// Default
	assert.Equal(t, 60*time.Second, workerCtx.getInterval(ctx))

	// Custom via AutoApprovalInterval (as proxy)
	_, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
		Settings: &pb.Settings{
			ProfileId:            "default",
			AutoApprovalInterval: 120,
		},
	})
	assert.NoError(t, err)

	assert.Equal(t, 120*time.Second, workerCtx.getInterval(ctx))
}
