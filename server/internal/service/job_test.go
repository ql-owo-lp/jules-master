package service

import (
	"context"
	"strings"
	"testing"
	"time"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestJobService_CreateAndGet(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	svc := &JobServer{DB: db}
	ctx := context.Background()

	now := time.Now().Format(time.RFC3339)
	req := &pb.CreateJobRequest{
		Id:         "1",
		Name:       "Test Job",
		SessionIds: []string{"session1"},
		CreatedAt:  now,
		Repo:       "test/repo",
		Branch:     "main",
	}

	created, err := svc.CreateJob(ctx, req)
	assert.NoError(t, err)
	assert.Equal(t, "Test Job", created.Name)

	got, err := svc.GetJob(ctx, &pb.GetJobRequest{Id: "1"})
	assert.NoError(t, err)
	assert.Equal(t, "Test Job", got.Name)
	assert.Equal(t, "session1", got.SessionIds[0])
}

func TestJobService_CreateManyAndList(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &JobServer{DB: db}
	ctx := context.Background()

	jobs := []*pb.CreateJobRequest{
		{Id: "2", Name: "Job 2", Repo: "test/repo", Branch: "main"},
		{Id: "3", Name: "Job 3", Repo: "test/repo", Branch: "main"},
	}

	_, err := svc.CreateManyJobs(ctx, &pb.CreateManyJobsRequest{Jobs: jobs})
	assert.NoError(t, err)

	list, err := svc.ListJobs(ctx, &emptypb.Empty{})
	assert.NoError(t, err)
	assert.Len(t, list.Jobs, 2)
}

func TestJobService_Update(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &JobServer{DB: db}
	ctx := context.Background()

	svc.CreateJob(ctx, &pb.CreateJobRequest{Id: "4", Name: "Old Name", Repo: "test/repo", Branch: "main"})

	newName := "New Name"
	_, err := svc.UpdateJob(ctx, &pb.UpdateJobRequest{Id: "4", Name: &newName})
	assert.NoError(t, err)

	got, err := svc.GetJob(ctx, &pb.GetJobRequest{Id: "4"})
	assert.NoError(t, err)
	assert.Equal(t, "New Name", got.Name)
}

func TestJobService_Delete(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &JobServer{DB: db}
	ctx := context.Background()

	svc.CreateJob(ctx, &pb.CreateJobRequest{Id: "5", Name: "To Delete", Repo: "test/repo", Branch: "main"})

	_, err := svc.DeleteJob(ctx, &pb.DeleteJobRequest{Id: "5"})
	assert.NoError(t, err)

	_, err = svc.GetJob(ctx, &pb.GetJobRequest{Id: "5"})
	assert.Error(t, err)
}

func TestJobService_Validation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &JobServer{DB: db}
	ctx := context.Background()

	longPrompt := strings.Repeat("a", 50001)
	longName := strings.Repeat("a", 256)

	// CreateJob
	_, err := svc.CreateJob(ctx, &pb.CreateJobRequest{Name: "Valid", Repo: "repo", Branch: "main", Prompt: longPrompt})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "prompt is too long")

	_, err = svc.CreateJob(ctx, &pb.CreateJobRequest{Name: longName, Repo: "repo", Branch: "main", Prompt: "Valid"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is too long")

	// CreateManyJobs
	_, err = svc.CreateManyJobs(ctx, &pb.CreateManyJobsRequest{Jobs: []*pb.CreateJobRequest{
		{Name: "Valid", Repo: "repo", Branch: "main", Prompt: longPrompt},
	}})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "prompt is too long")

	// UpdateJob
	svc.CreateJob(ctx, &pb.CreateJobRequest{Id: "v1", Name: "Initial", Repo: "repo", Branch: "main"})
	_, err = svc.UpdateJob(ctx, &pb.UpdateJobRequest{Id: "v1", Name: &longName})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is too long")
}
