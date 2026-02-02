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

type QueryCapturingGitHubClient struct {
	MockGitHubClient
	CapturedQuery string
}

func (m *QueryCapturingGitHubClient) SearchIssues(ctx context.Context, query string, opts *github.SearchOptions) (*github.IssuesSearchResult, *github.Response, error) {
	m.CapturedQuery = query
	return m.MockGitHubClient.SearchIssues(ctx, query, opts)
}

func TestRunCheck_QueryDoesNotContainStatusSuccess(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-query",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-query", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
				}{Url: "https://github.com/owner/repo/pull/1"}},
			},
		},
	}

	capturingGH := &QueryCapturingGitHubClient{
		MockGitHubClient: MockGitHubClient{
			IssuesSearchResult: &github.IssuesSearchResult{
				Issues: []*github.Issue{},
				Total:  github.Int(0),
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, capturingGH, mockFetcher, "test-api-key")

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if capturingGH.CapturedQuery == "" {
		t.Error("SearchIssues was not called or query not captured")
	}

	if strings.Contains(capturingGH.CapturedQuery, "status:success") {
		t.Errorf("Query should NOT contain 'status:success', got: %s", capturingGH.CapturedQuery)
	}
}
