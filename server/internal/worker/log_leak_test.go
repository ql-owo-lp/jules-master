package worker

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestLogLeak_PromptRedaction(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	jobSvc := &service.JobServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	settingsSvc := &service.SettingsServer{DB: db}
	workerCtx := NewBackgroundJobWorker(db, jobSvc, sessionSvc, settingsSvc)
	ctx := context.Background()

	// Create a unique secret string to look for in logs
	secret := uuid.New().String()
	// Construct a prompt > 50000 chars to ensure CreateSession fails locally
	// 50000 chars of 'A' + secret
	longPrompt := strings.Repeat("A", 50001) + " " + secret

	// Manually insert job because CreateJob validates prompt length
	id := uuid.New().String()
	_, err := db.Exec(`INSERT INTO jobs (
        id, name, session_ids, created_at, repo, branch,
        auto_approval, background, prompt, session_count,
        status, automation_mode, require_plan_approval, profile_id
    ) VALUES (?, 'leak-test', '[]', '2023-01-01T00:00:00Z', 'repo', 'branch',
        0, 1, ?, 1, 'PENDING', 'MODE', 0, 'default')`, id, longPrompt)
	if err != nil {
		t.Fatalf("failed to insert job: %v", err)
	}

	// Run worker
	// ProcessJobs will find the job, try to create session, fail (because prompt too long), and log error
	err = workerCtx.ProcessJobs(ctx)
	// ProcessJobs doesn't return error if individual job fails, it just logs
	assert.NoError(t, err)

	// Fetch logs
	logs, err := logger.Get("")
	if err != nil {
		t.Fatalf("failed to get logs: %v", err)
	}

	// Check if secret is in any log message
	found := false
	for _, l := range logs {
		if strings.Contains(l.Message, secret) {
			found = true
			t.Logf("Found secret in log: %s", l.Message)
			break
		}
	}

	// Assert that secret is NOT found
	assert.False(t, found, "Secret prompt should not be logged")
}
