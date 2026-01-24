package worker

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

func TestRunCheck_PaginatedCheckRuns(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-pagination",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-paged", "owner/repo", "test-job", time.Now(), "main", "test prompt")

	mockFetcher := &MockSessionFetcher{
		Session: &RemoteSession{
			Id:    sess.Id,
			State: "IN_PROGRESS",
			Outputs: []struct {
				PullRequest *struct {
					Url string `json:"url"`
				} `json:"pullRequest"`
			}{
				{PullRequest: &struct {
					Url string `json:"url"`
				}{Url: "https://github.com/owner/repo/pull/7"}},
			},
		},
	}

	// Create many check runs, with the failure on the SECOND page (assuming page size 30)
	var checks []*github.CheckRun
	// 30 success checks
	for i := 0; i < 30; i++ {
		checks = append(checks, &github.CheckRun{
			Name:       github.String("test-ok"),
			Status:     github.String("completed"),
			Conclusion: github.String("success"),
		})
	}
	// 1 failure on next page
	checks = append(checks, &github.CheckRun{
		Name:       github.String("test-fail-page-2"),
		Status:     github.String("completed"),
		Conclusion: github.String("failure"),
	})

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("failure"),
		},
		CheckRuns: &github.ListCheckRunsResults{
			CheckRuns: checks,
			Total:     github.Int(len(checks)),
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(7),
				HTMLURL: github.String("https://github.com/owner/repo/pull/7"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-page"),
					Ref: github.String("branch-page"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	// Should comment because it should find the failure on page 2
	if len(mockGH.CreatedComments) != 1 {
		t.Errorf("expected 1 comment, got %d", len(mockGH.CreatedComments))
	} else {
        // Optional: verify the comment mentions the specific failed check
        expected := failureCommentPrefix + "\n- test-fail-page-2\n\n@jules"
        if mockGH.CreatedComments[0] != expected {
             t.Errorf("Unexpected comment content: %s \nExpected: %s", mockGH.CreatedComments[0], expected)
        }
    }
}
