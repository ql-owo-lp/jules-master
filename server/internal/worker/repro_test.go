package worker

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

func TestRepro_YieldToHumans_BlocksCommenting(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Setup: PR failing, but last comment is by human
	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "repro-yield"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-repro-1", "owner/repo", "test-job", time.Now(), "main", "test")

	mockFetcher := &MockSessionFetcher{
		Session: &RemoteSession{
			Id: sess.Id, Outputs: []struct {
				PullRequest *struct {
					Url string `json:"url"`
				} `json:"pullRequest"`
			}{{PullRequest: &struct {
				Url string `json:"url"`
			}{Url: "https://url"}}},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{State: github.String("failure")},
		CheckRuns: &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("test-fail"), Status: github.String("completed"), Conclusion: github.String("failure")},
			},
		},
		PullRequests: []*github.PullRequest{{
			Number: github.Int(1), State: github.String("open"), HTMLURL: github.String("https://url"),
			Head: &github.PullRequestBranch{SHA: github.String("sha12345")},
			User: &github.User{Login: github.String("user")},
		}},
		Comments: []*github.IssueComment{
			{User: &github.User{Login: github.String("human-user")}, Body: github.String("Why is this failing?")},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "key")
	worker.runCheck(context.Background())

	if len(mockGH.CreatedComments) == 0 {
		t.Errorf("Expected comment despite YieldToHumans, but got 0")
	} else {
		t.Log("Confirmed: Bot commented despite human interaction.")
	}
}

func TestRepro_InProgress_BlocksCommenting(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Setup: PR failing (one check failed), but another is in_progress
	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "repro-progress"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-repro-2", "owner/repo", "test-job", time.Now(), "main", "test")

	mockFetcher := &MockSessionFetcher{
		Session: &RemoteSession{
			Id: sess.Id, Outputs: []struct {
				PullRequest *struct {
					Url string `json:"url"`
				} `json:"pullRequest"`
			}{{PullRequest: &struct {
				Url string `json:"url"`
			}{Url: "https://url2"}}},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{State: github.String("failure")}, // Overall pending or failure, but check runs matter
		CheckRuns: &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("test-fail"), Status: github.String("completed"), Conclusion: github.String("failure")},
				{Name: github.String("test-running"), Status: github.String("in_progress")},
			},
		},
		PullRequests: []*github.PullRequest{{
			Number: github.Int(2), State: github.String("open"), HTMLURL: github.String("https://url2"),
			Head: &github.PullRequestBranch{SHA: github.String("sha12345")},
			User: &github.User{Login: github.String("user")},
		}},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "key")
	worker.runCheck(context.Background())

	if len(mockGH.CreatedComments) == 0 {
		t.Errorf("Expected comment despite in_progress check, but got 0")
	} else {
		t.Log("Confirmed: Bot commented despite in_progress check.")
	}
}
