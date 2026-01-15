package worker

import (
	"context"
	"testing"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestCronWorker_RunCheck(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    cronSvc := &service.CronJobServer{DB: db}
    jobSvc := &service.JobServer{DB: db}
    workerCtx := NewCronWorker(db, cronSvc, jobSvc)
    ctx := context.Background()

    // 1. Create a Cron Job scheduled for every minute
    _, err := cronSvc.CreateCronJob(ctx, &pb.CreateCronJobRequest{
        Name: "test-cron",
        Schedule: "* * * * *", // Every minute
        Prompt: "Test",
        Repo: "test/repo",
        Branch: "main",
        // Enabled: true, // Not in request
    })
    assert.NoError(t, err)

    // 2. Clear LastRunAt to ensure it is considered "new" or "due"
    // (Actually implementation compares prev schedule time vs last run.
    // If new, lastRunAt might be empty. Logic uses created_at fallback.
    // Logic: prevDate > lastRun -> trigger.
    // If created just now, prevDate (minute ago) < created_at (now). So it WON'T run immediately?)
    
    // To FORCE run, we need to backdate created_at or last_run_at.
    _, err = db.Exec("UPDATE cron_jobs SET created_at = ?, last_run_at = ? WHERE name = 'test-cron'", 
        time.Now().Add(-2*time.Minute).Format(time.RFC3339),
        time.Now().Add(-2*time.Minute).Format(time.RFC3339))
    assert.NoError(t, err)

    // 3. Run Check
    // 3. Run Check
    err = workerCtx.runCheck(ctx)
    assert.NoError(t, err)
    assert.NoError(t, err)

    // 4. Verify Job Created
    jobs, err := jobSvc.ListJobs(ctx, &emptypb.Empty{})
    assert.NoError(t, err)
    
    found := false
    for _, j := range jobs.Jobs {
        if j.Name == "test-cron" {
            found = true
            break
        }
    }
    assert.True(t, found, "Job should have been created from cron")
}
