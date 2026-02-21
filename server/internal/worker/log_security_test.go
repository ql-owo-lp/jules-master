package worker

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestBackgroundJobWorker_DoesNotLogPromptOnError(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	jobSvc := &service.JobServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db, RateLimitDuration: 1 * time.Nanosecond}
	settingsSvc := &service.SettingsServer{DB: db}
	workerCtx := NewBackgroundJobWorker(db, jobSvc, sessionSvc, settingsSvc)
	ctx := context.Background()

	sensitivePrompt := "SENSITIVE_DATA_DO_NOT_LOG"
	// Invalid repo to force failure in CreateSession
	invalidRepo := "invalid repo"

	// Insert job with PENDING status.
	// We need to match the job structure expected by ProcessJobs.
	// ProcessJobs selects 'id, session_count' FROM jobs WHERE status = 'PENDING'
	// We use 'session_count' 1 to trigger one CreateSession call.
	// We set 'repo' and 'prompt' as well.
	_, err := db.Exec(`INSERT INTO jobs (
        id, name, status, session_count, session_ids, created_at, repo, branch, prompt, profile_id
    ) VALUES ('job-log-test', 'log-test-job', 'PENDING', 1, '[]', '2023-01-01T00:00:00Z', ?, 'main', ?, 'default')`,
		invalidRepo, sensitivePrompt)
	assert.NoError(t, err)

	// Run ProcessJobs
	// This will call CreateSession, which will call ValidateRepo, which will fail because of "invalid repo".
	// The worker should log the error, and currently, it also logs the prompt.
	err = workerCtx.ProcessJobs(ctx)
	assert.NoError(t, err)

	// Check logs
	// Since logger is global, we fetch all logs.
	// We filter by checking if the message contains our sensitive prompt.
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
		t.Fatalf("Sensitive prompt was found in logs! This is a security vulnerability.")
	}
}
