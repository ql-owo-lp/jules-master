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
	LastSearchQuery string
}

func (m *QueryCapturingGitHubClient) SearchIssues(ctx context.Context, query string, opts *github.SearchOptions) (*github.IssuesSearchResult, *github.Response, error) {
	m.LastSearchQuery = query
	return m.MockGitHubClient.SearchIssues(ctx, query, opts)
}

func TestRunCheck_SearchQuery_IncludesAllPRs(t *testing.T) {
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

	mockGH := &QueryCapturingGitHubClient{
		MockGitHubClient: MockGitHubClient{
			PullRequests: []*github.PullRequest{},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Fatalf("runCheck failed: %v", err)
	}

	if strings.Contains(mockGH.LastSearchQuery, "status:success") {
		t.Errorf("Search query should NOT contain 'status:success', but got: %s", mockGH.LastSearchQuery)
	}
}
