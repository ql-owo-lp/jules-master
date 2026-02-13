package service

import (
	"context"
	"testing"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestValidation_Reproduction(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	jobSvc := &JobServer{DB: db}
	cronSvc := &CronJobServer{DB: db}
	ctx := context.Background()

	// 1. Test CreateJob with invalid repo
	invalidRepo := "invalid repo with spaces"
	reqJob := &pb.CreateJobRequest{
		Name:       "Test Job",
		Repo:       invalidRepo,
		Branch:     "main",
		Prompt:     "Do something",
		SessionIds: []string{"s1"},
	}
	// Expecting FAILURE (error) because validation is now applied
	_, err := jobSvc.CreateJob(ctx, reqJob)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid repo format")

	// 2. Test CreateJob with invalid branch
	invalidBranch := "branch with spaces"
	reqJob2 := &pb.CreateJobRequest{
		Name:   "Test Job 2",
		Repo:   "owner/repo",
		Branch: invalidBranch,
		Prompt: "Do something",
	}
	_, err = jobSvc.CreateJob(ctx, reqJob2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid branch format")

	// 3. Test CronJob Create with invalid repo
	reqCron := &pb.CreateCronJobRequest{
		Name:     "Cron 1",
		Schedule: "@daily",
		Prompt:   "Prompt",
		Repo:     "bad/repo!",
		Branch:   "main",
	}
	_, err = cronSvc.CreateCronJob(ctx, reqCron)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid repo format")

	// 4. Test CronJob Update with invalid repo
	// First create a valid one
	validCron, err := cronSvc.CreateCronJob(ctx, &pb.CreateCronJobRequest{
		Name:     "Valid Cron",
		Schedule: "@daily",
		Prompt:   "Prompt",
		Repo:     "good/repo",
		Branch:   "main",
	})
	assert.NoError(t, err)

	badRepo := "bad/repo@"
	_, err = cronSvc.UpdateCronJob(ctx, &pb.UpdateCronJobRequest{
		Id:   validCron.Id,
		Repo: &badRepo,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid repo format")
}
