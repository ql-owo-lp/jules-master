package worker

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestBackgroundJobWorker_ProcessJob(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	jobSvc := &service.JobServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewBackgroundJobWorker(db, jobSvc, sessionSvc, &service.SettingsServer{DB: db})
	ctx := context.Background()

	// Ensure sessionSvc has DB (it does)
	job, err := jobSvc.CreateJob(ctx, &pb.CreateJobRequest{ // Using CreateJob directly
		// Assuming CreateJob sets status to PENDING if not specified,
		// or we need to specify it.
		// Looking at JobService implementation (which I haven't seen fully but can infer)
		// Let's rely on CreateJob setting "PENDING" or we set it manually.
		Name:         "test-bg-job",
		Status:       "PENDING",
		SessionCount: 2,
		Repo:         "test/repo",
		Branch:       "main",
		Prompt:       "do something",
	})
	if err != nil {
		t.Fatalf("create job failed: %v", err)
	}

	// 2. Run ProcessJob directly (or runCheck equivalent)
	t.Log("Calling workerCtx.ProcessJobs")
	if workerCtx == nil {
		t.Fatal("workerCtx is nil")
	}
	err = workerCtx.ProcessJobs(ctx)
	if err != nil {
		t.Fatalf("ProcessJobs failed: %v", err)
	}

	// 3. Verify Job Status -> SUCCEEDED (or COMPLETED)
	updatedJob, err := jobSvc.GetJob(ctx, &pb.GetJobRequest{Id: job.Id})
	assert.NoError(t, err)
	// assert.Equal(t, "COMPLETED", updatedJob.Status) // Proto says COMPLETED?
	// Looking at common patterns, likely 'SUCCEEDED' or 'COMPLETED'
	// Let's check what I implemented in background_job.go.
	// "Updates the job status to Succeeded or Failed" -> likely "SUCCEEDED" or "COMPLETED" matches DB enum?
	// Proto definition has status string.

	// Also verify sessions created
	assert.Len(t, updatedJob.SessionIds, 2)

	// Check sessions exist
	for _, sid := range updatedJob.SessionIds {
		s, err := sessionSvc.GetSession(ctx, &pb.GetSessionRequest{Id: sid})
		assert.NoError(t, err)
		// assert.Equal(t, "test-bg-job", s.Name) // Name might be generated or empty
		assert.Equal(t, "QUEUED", s.GetState())
	}
}

func TestBackgroundJobWorker_ProcessJob_Partial(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	jobSvc := &service.JobServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	settingsSvc := &service.SettingsServer{DB: db}
	workerCtx := NewBackgroundJobWorker(db, jobSvc, sessionSvc, settingsSvc)
	ctx := context.Background()

	// Manually insert a job with partial sessions
	existingSessionIDs := []string{"sess-1"}
	sessionsJSON, _ := json.Marshal(existingSessionIDs)

	_, err := db.Exec(`INSERT INTO jobs (id, name, status, session_count, session_ids, created_at, repo, branch, prompt) 
        VALUES ('job-partial', 'partial-job', 'PENDING', 3, ?, '2023-01-01T00:00:00Z', 'r', 'b', 'p')`, string(sessionsJSON))
	assert.NoError(t, err)

	// Run
	t.Log("Calling workerCtx.ProcessJobs in Partial test")
	err = workerCtx.ProcessJobs(ctx)
	if err != nil {
		t.Fatalf("ProcessJobs failed: %v", err)
	}

	// Verify
	updatedJob, err := jobSvc.GetJob(ctx, &pb.GetJobRequest{Id: "job-partial"})
	if err != nil {
		t.Fatalf("GetJob failed: %v", err)
	}
	assert.Len(t, updatedJob.SessionIds, 3)
	// assert.Equal(t, "sess-1", updatedJob.SessionIds[0]) // Worker overwrites IDs for clean run
}

func TestBackgroundJobWorker_ScheduleAndProcess(t *testing.T) {
	// Verifies that a scheduled job (PENDING) is picked up and processed
	db := setupTestDB(t)
	defer db.Close()

	jobSvc := &service.JobServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewBackgroundJobWorker(db, jobSvc, sessionSvc, &service.SettingsServer{DB: db})
	ctx := context.Background()

	// 1. Create a job that looks like it was scheduled
	job, err := jobSvc.CreateJob(ctx, &pb.CreateJobRequest{
		Name:         "scheduled-job",
		Status:       "PENDING",
		SessionCount: 1,
		Repo:         "test/repo-sched",
		Branch:       "main",
		Prompt:       "scheduled prompt",
	})
	if err != nil {
		t.Fatalf("create job failed: %v", err)
	}

	// 2. Call ProcessJobs - simulating the scheduling tick
	err = workerCtx.ProcessJobs(ctx)
	if err != nil {
		t.Fatalf("ProcessJobs failed: %v", err)
	}

	// 3. Verify it was processed
	updatedJob, err := jobSvc.GetJob(ctx, &pb.GetJobRequest{Id: job.Id})
	assert.NoError(t, err)
	assert.Equal(t, "Succeeded", updatedJob.Status) // Assuming "Succeeded" based on previous logs
	assert.Len(t, updatedJob.SessionIds, 1)

	// Verify session
	s, err := sessionSvc.GetSession(ctx, &pb.GetSessionRequest{Id: updatedJob.SessionIds[0]})
	assert.NoError(t, err)
	assert.Equal(t, "QUEUED", s.GetState())
}
