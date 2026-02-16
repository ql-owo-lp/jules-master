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

	// Use a unique sensitive string for prompt
	sensitivePrompt := "SENSITIVE_DATA_DO_NOT_LOG_" + time.Now().String()
	// Invalid repo to force failure in CreateSession
	invalidRepo := "invalid repo"

	// Directly insert job into DB to bypass CreateJob validation,
	// but fail during CreateSession which calls validation.
	_, err := db.Exec(`INSERT INTO jobs (
        id, name, status, session_count, session_ids, created_at, repo, branch, prompt, profile_id
    ) VALUES ('job-log-test', 'log-test-job', 'PENDING', 1, '[]', '2023-01-01T00:00:00Z', ?, 'main', ?, 'default')`,
		invalidRepo, sensitivePrompt)
	assert.NoError(t, err)

	// Run ProcessJobs
	// This should pick up the job, try to process it, fail at session creation, and log the error.
	err = workerCtx.ProcessJobs(ctx)
	assert.NoError(t, err)

	// Check logs
	// Since logger stores logs in a global buffer, we can inspect them.
	// We use an empty string for "since" to get all logs.
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
