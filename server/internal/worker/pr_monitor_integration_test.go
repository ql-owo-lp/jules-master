package worker

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

func TestPRMonitor_Comprehensive(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// 1. Create a session and job
	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "comprehensive-test-session",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)",
		"job-comp", "owner/repo", "test-job", time.Now(), "main", "test prompt")

	prUrl := "https://github.com/owner/repo/pull/100"
	mockFetcher := &MockSessionFetcher{
		Session: &RemoteSession{
			Id:    sess.Id,
			State: "IN_PROGRESS",
			Outputs: []struct {
				PullRequest *struct {
					Url string `json:"url"`
				} `json:"pullRequest"`
			}{
				{
					PullRequest: &struct {
						Url string `json:"url"`
					}{
						Url: prUrl,
					},
				},
			},
		},
	}

	mockGH := &MockGitHubClient{
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(100),
				HTMLURL: github.String(prUrl),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-comp"),
					Ref: github.String("branch-comp"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
		User: &github.User{
			Login: github.String("google-labs-jules"),
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")

	t.Run("Wait for pending checks", func(t *testing.T) {
		mockGH.CombinedStatus = &github.CombinedStatus{State: github.String("failure")}
		mockGH.CheckRuns = &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("check-1"), Status: github.String("completed"), Conclusion: github.String("failure")},
				{Name: github.String("check-2"), Status: github.String("in_progress")}, // Still running
			},
		}

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		if len(mockGH.CreatedComments) != 0 {
			t.Errorf("expected 0 comments while checks are in_progress, got %d", len(mockGH.CreatedComments))
		}
	})

	t.Run("Comment when all checks done and failed (Status: failure)", func(t *testing.T) {
		mockGH.CheckRuns = &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("check-1"), Status: github.String("completed"), Conclusion: github.String("failure")},
				{Name: github.String("check-2"), Status: github.String("completed"), Conclusion: github.String("success")},
			},
		}
		// Also add a legacy status failure
		mockGH.CombinedStatus.Statuses = []*github.RepoStatus{
			{Context: github.String("legacy-check"), State: github.String("failure")},
		}

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		if len(mockGH.CreatedComments) != 1 {
			t.Errorf("expected 1 comment, got %d", len(mockGH.CreatedComments))
		}

		expectedBody := failureCommentPrefix + "\n- check-1\n- legacy-check\n\n@jules"
		if mockGH.CreatedComments[0] != expectedBody {
			t.Errorf("unexpected comment body.\nExpected:\n%s\nGot:\n%s", expectedBody, mockGH.CreatedComments[0])
		}
	})

	t.Run("Skip if bot's failure comment is already the last comment", func(t *testing.T) {
		mockGH.Comments = []*github.IssueComment{
			{
				User: &github.User{Login: github.String("google-labs-jules")},
				Body: github.String("Random body"), // Logic depends on author only now? No, pr_monitor code I saw checked author.
                // Wait, code was: 
                // if lastComment.User... "google-labs-jules" {
                //    logger...
                //    shouldComment = false
                // }
                // So ANY last comment by bot skips.
			},
		}

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		// Now we expect 0 comments because it skipped
		if len(mockGH.CreatedComments) != 1 {
			t.Errorf("expected still 1 comment (skipped redundant), got %d", len(mockGH.CreatedComments))
		}
	})

	t.Run("Re-comment if human intervenes", func(t *testing.T) {
		mockGH.Comments = append(mockGH.Comments, &github.IssueComment{
			User: &github.User{Login: github.String("human-user")},
			Body: github.String("I'm fixing this now."),
		})

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		if len(mockGH.CreatedComments) != 2 {
			t.Errorf("expected 2 comments (re-commented after human), got %d", len(mockGH.CreatedComments))
		}
	})

	t.Run("Correctly handle 'pending' combined status when checks are actually done", func(t *testing.T) {
		// Reset comments for this sub-run
		mockGH.Comments = nil
		mockGH.CreatedComments = nil

		mockGH.CombinedStatus = &github.CombinedStatus{State: github.String("pending")} // Overall is pending
		mockGH.CheckRuns = &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("check-fail"), Status: github.String("completed"), Conclusion: github.String("failure")},
				{Name: github.String("check-pass"), Status: github.String("completed"), Conclusion: github.String("success")},
			},
		}

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		if len(mockGH.CreatedComments) != 1 {
			t.Errorf("expected 1 comment (handled pending status with completed failure), got %d", len(mockGH.CreatedComments))
		}

		if !strings.Contains(mockGH.CreatedComments[0], "check-fail") {
			t.Errorf("comment body missing failing check name")
		}
	})
}
