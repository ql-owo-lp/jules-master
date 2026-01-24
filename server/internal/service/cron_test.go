package service

import (
	"context"
	"testing"
	"time"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestCronJobService_CRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &CronJobServer{DB: db}
	ctx := context.Background()

	// Create
	req := &pb.CreateCronJobRequest{
		Name:     "Cron 1",
		Schedule: "* * * * *",
		Prompt:   "Do stuff",
		Repo:     "user/repo",
		Branch:   "main",
	}

	created, err := svc.CreateCronJob(ctx, req)
	assert.NoError(t, err)
	assert.NotEmpty(t, created.Id)
	assert.Equal(t, "Cron 1", created.Name)

	// List
	list, err := svc.ListCronJobs(ctx, &emptypb.Empty{})
	assert.NoError(t, err)
	assert.Len(t, list.CronJobs, 1)

	// Toggle (should update updatedAt)
	time.Sleep(1 * time.Second) // Ensure time diff
	oldUpdated := created.UpdatedAt

	_, err = svc.ToggleCronJob(ctx, &pb.ToggleCronJobRequest{Id: created.Id, Enabled: false})
	assert.NoError(t, err)

	// Fetch to check
	// We don't have GetCronJob in proto/service yet?
	// Wait, proto has: List, Create, Update, Delete, Execute, Toggle.
	// No Get. I have to List to verify.
	list, _ = svc.ListCronJobs(ctx, &emptypb.Empty{})
	updated := list.CronJobs[0]
	assert.False(t, updated.Enabled)
	assert.NotEqual(t, oldUpdated, updated.UpdatedAt)

	// Delete
	_, err = svc.DeleteCronJob(ctx, &pb.DeleteCronJobRequest{Id: created.Id})
	assert.NoError(t, err)

	list, _ = svc.ListCronJobs(ctx, &emptypb.Empty{})
	assert.Len(t, list.CronJobs, 0)
}
