package worker

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/ratelimit"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestBackgroundJobWorker_DoesNotLogPromptOnError(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	jobSvc := &service.JobServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db, Limiter: ratelimit.New(1 * time.Nanosecond)}
	settingsSvc := &service.SettingsServer{DB: db}
	workerCtx := NewBackgroundJobWorker(db, jobSvc, sessionSvc, settingsSvc)
	ctx := context.Background()

	// The sensitive prompt that should NOT be logged
	sensitivePrompt := "SENSITIVE_DATA_DO_NOT_LOG_12345"
	// Invalid repo to force failure in CreateSession (which calls ValidateRepo)
	invalidRepo := "invalid repo with spaces"

	_, err := db.Exec(`INSERT INTO jobs (
        id, name, status, session_count, session_ids, created_at, repo, branch, prompt, profile_id
    ) VALUES (?, ?, 'PENDING', 1, '[]', '2023-01-01T00:00:00Z', ?, 'main', ?, 'default')`,
		"job-log-test", "log-test-job", invalidRepo, sensitivePrompt)
	assert.NoError(t, err)

	// Run ProcessJobs
	// This will attempt to process the job. CreateSession will fail due to invalidRepo.
	// The worker catches the error and logs it.
	err = workerCtx.ProcessJobs(ctx)
	assert.NoError(t, err)

	// Check logs
	// Since logger is global, we fetch all logs.
	logs, err := logger.Get("")
	assert.NoError(t, err)

	foundSensitive := false
	for _, l := range logs {
		if strings.Contains(l.Message, sensitivePrompt) {
			foundSensitive = true
			break
		}
	}

	if foundSensitive {
		t.Errorf("SECURITY VULNERABILITY: Sensitive prompt was found in logs! It should not be logged on error.")
	}
}
