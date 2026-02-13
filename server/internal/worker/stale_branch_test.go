package worker

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/github"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
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
			ProfileId:               "default",
			AutoDeleteStaleBranches: true,
			Theme:                   "system",
			AutoMergeMethod:         "squash",
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

func TestAutoDeleteStaleBranchWorker_RunCheck_DeletesStale(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	settingsSvc := &service.SettingsServer{DB: db}

	// Enable
	_, err := settingsSvc.UpdateSettings(context.Background(), &pb.UpdateSettingsRequest{
		Settings: &pb.Settings{
			ProfileId:               "default",
			AutoDeleteStaleBranches: true,
			Theme:                   "system",
			AutoMergeMethod:         "squash",
		},
	})
	assert.NoError(t, err)

	// Setup Mock Server
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && strings.Contains(r.URL.Path, "/branches") {
			// Return branches
			fmt.Fprint(w, `[{"name":"main"}, {"name":"jules-stale"}]`)
		} else if r.Method == "DELETE" {
			// Verify deletion
			assert.Contains(t, r.URL.Path, "jules-stale")
			w.WriteHeader(http.StatusNoContent)
		}
	})
	server := httptest.NewServer(handler)
	defer server.Close()

	workerCtx := NewAutoDeleteStaleBranchWorker(db, settingsSvc)
	workerCtx.clientFactory = func(token string) *github.Client {
		c := github.NewClient(token)
		c.SetBaseURL(server.URL + "/")
		return c
	}

	// Insert job to define repo
	db.Exec("INSERT INTO jobs (id, repo, name) VALUES (?, ?, ?)", "req1", "owner/repo", "job1")

	// We need to set GITHUB_TOKEN for runCheck to proceed (unless we mock that check out? No, runCheck checks env)
	t.Setenv("GITHUB_TOKEN", "dummy")

	err = workerCtx.runCheck(context.Background())
	assert.NoError(t, err)
}
