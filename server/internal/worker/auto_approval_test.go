package worker

import (
	"context"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestAutoApprovalWorker_RunCheck(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	settingsSvc := &service.SettingsServer{DB: db}
	t.Setenv("JULES_API_KEY", "")
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewAutoApprovalWorker(db, settingsSvc, sessionSvc)

	ctx := context.Background()

	// 1. Setup Settings (Enabled)
	_, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
		Settings: &pb.Settings{
			ProfileId:               "default",
			AutoApprovalEnabled:     true,
			AutoApprovalInterval:    1,
			AutoApprovalAllSessions: true,
			Theme:                   "system",
			AutoMergeMethod:         "squash",
		},
	})
	if err != nil {
		t.Fatalf("setup settings failed: %v", err)
	}

	// 2. Create a session awaiting approval
	session, err := sessionSvc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "test-session"})
	if err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	// Manually force state to AWAITING_PLAN_APPROVAL for testing (since API doesn't allow direct set usually)
	_, err = db.Exec("UPDATE sessions SET state = 'AWAITING_PLAN_APPROVAL' WHERE id = ?", session.Id)
	if err != nil {
		t.Fatalf("update state failed: %v", err)
	}

	// 3. Run Check
	err = workerCtx.runCheck(ctx)
	if err != nil {
		t.Fatalf("runCheck failed: %v", err)
	}

	// 4. Verify Session State changed to IN_PROGRESS
	updatedSession, err := sessionSvc.GetSession(ctx, &pb.GetSessionRequest{Id: session.Id})
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	assert.Equal(t, "IN_PROGRESS", updatedSession.State)
}

func TestAutoApprovalWorker_RunCheck_Disabled(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	settingsSvc := &service.SettingsServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewAutoApprovalWorker(db, settingsSvc, sessionSvc)
	ctx := context.Background()

	// 1. Setup Settings (Disabled)
	_, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
		Settings: &pb.Settings{
			ProfileId:           "default",
			AutoApprovalEnabled: false,
			Theme:               "system",
			AutoMergeMethod:     "squash",
		},
	})
	if err != nil {
		t.Fatalf("setup settings failed: %v", err)
	}

	// 2. Create a session awaiting approval
	session, err := sessionSvc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "test-session"})
	if err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	_, err = db.Exec("UPDATE sessions SET state = 'AWAITING_PLAN_APPROVAL' WHERE id = ?", session.Id)
	if err != nil {
		t.Fatalf("update state failed: %v", err)
	}

	// 3. Run Check
	err = workerCtx.runCheck(ctx)
	if err != nil {
		t.Fatalf("runCheck failed: %v", err)
	}

	// 4. Verify Session State did NOT change
	updatedSession, err := sessionSvc.GetSession(ctx, &pb.GetSessionRequest{Id: session.Id})
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	assert.Equal(t, "AWAITING_PLAN_APPROVAL", updatedSession.State)
}

func TestAutoApprovalWorker_GetInterval(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	settingsSvc := &service.SettingsServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewAutoApprovalWorker(db, settingsSvc, sessionSvc)
	ctx := context.Background()

	// Default
	assert.Equal(t, 60*time.Second, workerCtx.getInterval(ctx))

	// Custom
	_, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
		Settings: &pb.Settings{
			ProfileId:            "default",
			AutoApprovalInterval: 120,
			Theme:                "system",
			AutoMergeMethod:      "squash",
		},
	})
	assert.NoError(t, err)
	assert.Equal(t, 120*time.Second, workerCtx.getInterval(ctx))
}
