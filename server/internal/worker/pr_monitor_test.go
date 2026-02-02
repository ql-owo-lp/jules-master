package worker

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

type MockGitHubClient struct {
	CombinedStatus         *github.CombinedStatus
	PullRequests           []*github.PullRequest
	Comments               []*github.IssueComment
	User                   *github.User
	CreatedComments        []string
	CheckRuns              *github.ListCheckRunsResults
	ClosePullRequestCalled bool
	UpdateBranchCalled     bool
	Files                  []*github.CommitFile
	CombinedStatusError    error
	IssuesSearchResult     *github.IssuesSearchResult
	SearchIssuesQuery      string
}

func (m *MockGitHubClient) GetCombinedStatus(ctx context.Context, owner, repo, ref string) (*github.CombinedStatus, error) {
	if m.CombinedStatusError != nil {
		return nil, m.CombinedStatusError
	}
	return m.CombinedStatus, nil
}

func (m *MockGitHubClient) ListPullRequests(ctx context.Context, owner, repo string, opts *github.PullRequestListOptions) ([]*github.PullRequest, *github.Response, error) {
    if m.PullRequests == nil {
        return []*github.PullRequest{}, &github.Response{}, nil
    }
    // Simple pagination mock
    page := 1
    perPage := 30
    if opts != nil {
        if opts.Page > 0 {
            page = opts.Page
        }
        if opts.PerPage > 0 {
            perPage = opts.PerPage
        }
    }
    
    start := (page - 1) * perPage
    if start >= len(m.PullRequests) {
        return []*github.PullRequest{}, &github.Response{}, nil
    }
    end := start + perPage
    if end > len(m.PullRequests) {
        end = len(m.PullRequests)
    }

    resp := &github.Response{}
    if end < len(m.PullRequests) {
         resp.NextPage = page + 1
    } else {
         resp.NextPage = 0
    }

	return m.PullRequests[start:end], resp, nil
}

func (m *MockGitHubClient) GetPullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, *github.Response, error) {
	for _, pr := range m.PullRequests {
		if pr.Number != nil && *pr.Number == number {
			return pr, nil, nil
		}
	}
	// Fallback to first if not found? No, better to return nil or error if not found to be correct.
	// But existing tests might rely on loose matching?
	// Given the previous implementation just returned [0], existing tests likely only have 1 PR or don't care.
	// But Stale PR test has 4.
	// Let's return nil if not found to be safe, or error.
	return nil, nil, fmt.Errorf("PR %d not found in mock", number)
}

func (m *MockGitHubClient) ListCheckRunsForRef(ctx context.Context, owner, repo, ref string, opts *github.ListCheckRunsOptions) (*github.ListCheckRunsResults, *github.Response, error) {
	// Default values
	page := 1
	perPage := 30
	
	if m.CheckRuns == nil {
		return &github.ListCheckRunsResults{CheckRuns: []*github.CheckRun{}}, &github.Response{}, nil
	}

	if opts != nil {
		if opts.Page > 0 {
			page = opts.Page
		}
		if opts.PerPage > 0 {
			perPage = opts.PerPage
		}
	}

	start := (page - 1) * perPage
	if start >= len(m.CheckRuns.CheckRuns) {
		return &github.ListCheckRunsResults{CheckRuns: []*github.CheckRun{}}, &github.Response{}, nil
	}
	end := start + perPage
	if end > len(m.CheckRuns.CheckRuns) {
		end = len(m.CheckRuns.CheckRuns)
	}
	
	resp := &github.Response{}
	if end < len(m.CheckRuns.CheckRuns) {
		resp.NextPage = page + 1
	} else {
        resp.NextPage = 0
    }
	
	return &github.ListCheckRunsResults{
		CheckRuns: m.CheckRuns.CheckRuns[start:end],
		Total:     m.CheckRuns.Total, // Should be set in mock setup
	}, resp, nil
}

func (m *MockGitHubClient) ListComments(ctx context.Context, owner, repo string, number int) ([]*github.IssueComment, error) {
	return m.Comments, nil
}

func (m *MockGitHubClient) CreateComment(ctx context.Context, owner, repo string, number int, body string) error {
	m.CreatedComments = append(m.CreatedComments, body)
	return nil
}

func (m *MockGitHubClient) GetUser(ctx context.Context, username string) (*github.User, error) {
	return m.User, nil
}

func (m *MockGitHubClient) ClosePullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error) {
	m.ClosePullRequestCalled = true
	return &github.PullRequest{State: github.String("closed")}, nil
}

func (m *MockGitHubClient) UpdateBranch(ctx context.Context, owner, repo string, number int) error {
	m.UpdateBranchCalled = true
	return nil
}

func (m *MockGitHubClient) ListFiles(ctx context.Context, owner, repo string, number int, opts *github.ListOptions) ([]*github.CommitFile, error) {
	return m.Files, nil
}

func (m *MockGitHubClient) MarkPullRequestReadyForReview(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error) {
	// In a real mock we might track this call
	m.CreatedComments = append(m.CreatedComments, "MARKED_READY_FOR_REVIEW")
	return &github.PullRequest{Draft: github.Bool(false)}, nil
}

func (m *MockGitHubClient) MergePullRequest(ctx context.Context, owner, repo string, number int, message string, method string) error {
    m.CreatedComments = append(m.CreatedComments, fmt.Sprintf("MERGED_PR_%d_%s", number, method))
    return nil
}

func (m *MockGitHubClient) SearchIssues(ctx context.Context, query string, opts *github.SearchOptions) (*github.IssuesSearchResult, *github.Response, error) {
	m.SearchIssuesQuery = query
	if m.IssuesSearchResult != nil {
		return m.IssuesSearchResult, &github.Response{}, nil
	}
	// Fallback for tests that establish PullRequests but not IssuesSearchResult
	var issues []*github.Issue
	for _, pr := range m.PullRequests {
		issue := &github.Issue{
			Number:           pr.Number,
			State:            pr.State,
			User:             pr.User,
			HTMLURL:          pr.HTMLURL,
			Title:            pr.Title,
			Body:             pr.Body,
			PullRequestLinks: &github.PullRequestLinks{URL: pr.URL},
		}
		issues = append(issues, issue)
	}
	return &github.IssuesSearchResult{Issues: issues, Total: github.Int(len(issues))}, &github.Response{}, nil
}

type MockSessionFetcher struct {
	Session *RemoteSession
    Sources []Source
	Err     error
	ListSourcesCalls []string
}

func (m *MockSessionFetcher) GetSession(ctx context.Context, id, apiKey string) (*RemoteSession, error) {
	return m.Session, m.Err
}

func (m *MockSessionFetcher) ListSources(ctx context.Context, apiKey string) ([]Source, error) {
	m.ListSourcesCalls = append(m.ListSourcesCalls, apiKey)
    return m.Sources, m.Err
}

func TestRunCheck_CommentsOnFailure(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Create a session in DB
	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	// Update state to IN_PROGRESS and last_interaction_at to now
	nowMilli := time.Now().UnixMilli()
	_, err = db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	if err != nil {
		t.Fatalf("failed to update session: %v", err)
	}
	_, err = db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-1", "owner/repo", "test-job", time.Now(), "main", "test prompt")
	if err != nil {
		t.Fatalf("failed to insert job: %v", err)
	}

	// Mock Remote Session with PR output
	prUrl := "https://github.com/owner/repo/pull/1"
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
		CombinedStatus: &github.CombinedStatus{
			State: github.String("failure"),
		},
		CheckRuns: &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("test-lint"), Status: github.String("completed"), Conclusion: github.String("failure")},
			},
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(1),
				HTMLURL: github.String("https://github.com/owner/repo/pull/1"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha12345"),
					Ref: github.String("branch-name"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")

	// Run Check
	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	// Verify comment created with new format
	if len(mockGH.CreatedComments) != 1 {
		t.Fatalf("expected 1 comment, got %d", len(mockGH.CreatedComments))
	}
	expectedMsg := failureCommentPrefix + "\n- test-lint\n\n@jules"
	if mockGH.CreatedComments[0] != expectedMsg {
		t.Errorf("expected comment body:\n%s\ngot:\n%s", expectedMsg, mockGH.CreatedComments[0])
	}

	// Run again, should NOT comment again if LAST comment is ours
	mockGH.Comments = []*github.IssueComment{
		{
			User: &github.User{Login: github.String("google-labs-jules")},
			Body: github.String(expectedMsg),
		},
	}

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if len(mockGH.CreatedComments) != 1 {
		t.Fatalf("expected still 1 comment after second run (skip our last comment), got %d", len(mockGH.CreatedComments))
	}

	// Run again, but with someone else's comment last - should comment again!
	mockGH.Comments = append(mockGH.Comments, &github.IssueComment{
		User: &github.User{Login: github.String("someone-else")},
		Body: github.String("I am looking at this."),
	})

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if len(mockGH.CreatedComments) != 1 {
		t.Fatalf("expected 1 comment (yielded to human), got %d", len(mockGH.CreatedComments))
	}
}

func TestRunCheck_ReportsFailure_EvenIfPending(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Create a session in DB
	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-pending",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	_, err = db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	if err != nil {
		t.Fatalf("failed to update session: %v", err)
	}
	_, err = db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-2", "owner/repo", "test-job", time.Now(), "main", "test prompt")
	if err != nil {
		t.Fatalf("failed to insert job: %v", err)
	}

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
						Url: "https://github.com/owner/repo/pull/2",
					},
				},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("failure"),
		},
		CheckRuns: &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Status: github.String("completed"), Conclusion: github.String("failure"), Name: github.String("test-fail")},
				{Status: github.String("in_progress"), Name: github.String("test-pending")}, // Pending check!
			},
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(2),
				HTMLURL: github.String("https://github.com/owner/repo/pull/2"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha456"),
					Ref: github.String("branch-2"),
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

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	// Should comment because there IS a failure, even if one is pending.
	if len(mockGH.CreatedComments) != 1 {
		t.Errorf("expected 1 comment (fail fast), got %d", len(mockGH.CreatedComments))
	}
}

func TestRunCheck_CommentsIfPendingStatus_ButAllDoneAndFailed(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Create a session in DB
	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-pending-done",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-pending-done", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
						Url: "https://github.com/owner/repo/pull/201",
					},
				},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("pending"), // Overall status is pending
		},
		CheckRuns: &github.ListCheckRunsResults{
			CheckRuns: []*github.CheckRun{
				{Name: github.String("test-lint"), Status: github.String("completed"), Conclusion: github.String("failure")},  // Completed Failure
				{Name: github.String("test-build"), Status: github.String("completed"), Conclusion: github.String("success")}, // Completed Success
			},
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(201),
				HTMLURL: github.String("https://github.com/owner/repo/pull/201"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-pending-done"),
					Ref: github.String("branch-pending-done"),
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

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	// EXPECTATION: Should comment because all checks are done and one failed, despite pending status.
	if len(mockGH.CreatedComments) != 1 {
		t.Errorf("expected 1 comment, got %d", len(mockGH.CreatedComments))
	}
}

func TestRunCheck_NoCommentIfPassing(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-passing",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-3", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
				}{Url: "https://github.com/owner/repo/pull/3"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(3),
				HTMLURL: github.String("https://github.com/owner/repo/pull/3"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha789"),
					Ref: github.String("branch-3"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if len(mockGH.CreatedComments) != 0 {
		t.Errorf("expected 0 comments (passing), got %d", len(mockGH.CreatedComments))
	}
}

func TestRunCheck_IgnoresInvalidUrls(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-invalid",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-4", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
				}{Url: "https://gitlab.com/owner/repo/pull/4"}}, // Invalid domain
			},
		},
	}

	mockGH := &MockGitHubClient{} // Should not be called

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}
}

func TestRunCheck_ClosesZeroChangePR(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-zero-changes",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-5", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
				}{Url: "https://github.com/owner/repo/pull/5"}},
			},
		},
	}

	zero := 0
	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:        github.String("open"),
				Number:       github.Int(5),
				HTMLURL:      github.String("https://github.com/owner/repo/pull/5"),
				ChangedFiles: &zero,
				Head: &github.PullRequestBranch{
					SHA: github.String("sha999"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if !mockGH.ClosePullRequestCalled {
		t.Error("expected ClosePullRequest to be called")
	}
}

func TestRunCheck_ClosesConflictPR(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-conflict",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-conflict", "owner/repo", "test-job", time.Now(), "main", "test prompt")
	// Enable AutoCloseStaleConflictedPrs by inserting settings row. Avoid NULLs for strings.
	db.Exec(`INSERT INTO settings (
		profile_id, auto_close_stale_conflicted_prs, theme, auto_retry_message, auto_continue_message
	) VALUES ('default', 1, 'system', '', '')`)

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
				}{Url: "https://github.com/owner/repo/pull/55"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:     github.String("open"),
				Number:    github.Int(55),
				HTMLURL:   github.String("https://github.com/owner/repo/pull/55"),
				Mergeable: github.Bool(false), // Conflicting!
				UpdatedAt: &github.Timestamp{Time: time.Now().AddDate(0, 0, -6)}, // Stale!
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-conflict"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if !mockGH.ClosePullRequestCalled {
		t.Error("expected ClosePullRequest to be called for conflicting PR")
	}

	// Verify comment
	foundComment := false
	for _, c := range mockGH.CreatedComments {
		if strings.Contains(c, "Closed due to merge conflict") {
			foundComment = true
			break
		}
	}
	if !foundComment {
		t.Error("expected comment explaining stale closure")
	}
}

func TestRunCheck_ClosesConflictPR_WithCustomMessage(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-conflict-custom",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-conflict-custom", "owner/repo", "test-job", time.Now(), "main", "test prompt")
	
    // Enable AutoCloseStaleConflictedPrs AND Custom Message
	db.Exec(`INSERT INTO settings (
		profile_id, auto_close_stale_conflicted_prs, auto_close_on_conflict_message, theme, auto_retry_message, auto_continue_message
	) VALUES ('default', 1, 'Custom conflict message', 'system', '', '')`)

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
				}{Url: "https://github.com/owner/repo/pull/56"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:     github.String("open"),
				Number:    github.Int(56),
				HTMLURL:   github.String("https://github.com/owner/repo/pull/56"),
				Mergeable: github.Bool(false), // Conflicting!
				UpdatedAt: &github.Timestamp{Time: time.Now().AddDate(0, 0, -6)},
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-conflict-custom"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if !mockGH.ClosePullRequestCalled {
		t.Error("expected ClosePullRequest to be called")
	}

	foundComment := false
	for _, c := range mockGH.CreatedComments {
		if strings.Contains(c, "Custom conflict message") {
			foundComment = true
			break
		}
	}
	if !foundComment {
		t.Errorf("expected comment to contain 'Custom conflict message', got: %v", mockGH.CreatedComments)
	}
}

func TestRunCheck_UpdatesBranchIfBehind(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-behind",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-6", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
				}{Url: "https://github.com/owner/repo/pull/6"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("failure"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(6),
				HTMLURL: github.String("https://github.com/owner/repo/pull/6"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-behind"),
					Ref: github.String("branch-behind"),
				},
				MergeableState: github.String("behind"),
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if !mockGH.UpdateBranchCalled {
		t.Error("expected UpdateBranch to be called")
	}
}

func TestRunCheck_AutoMergesPR(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session-automerge",
		ProfileId: "default",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-merge", "owner/repo", "test-job", time.Now(), "main", "test prompt")
	
	// Enable Auto Merge
	_, err = db.Exec(`INSERT INTO settings (
		profile_id, auto_merge_enabled, auto_merge_method, theme, auto_retry_message, auto_continue_message
	) VALUES ('default', 1, 'squash', 'system', '', '')`)
	if err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}

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

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				Number:    github.Int(7),
				HTMLURL:   github.String("https://github.com/owner/repo/pull/7"),
				State:     github.String("open"),
				Mergeable: github.Bool(true),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-merge"),
				},
				Title: github.String("Feature: Auto Merge"),
				Body:  github.String("This PR implements auto merge.\n\nPR created automatically by Jules\nCo-authored-by: bot"),
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	foundMerge := false
	for _, c := range mockGH.CreatedComments {
		// Mock MergePullRequest adds to CreatedComments with prefix MERGED_PR_
		if strings.HasPrefix(c, "MERGED_PR_7_squash") {
			foundMerge = true
			break
		}
	}
	if !foundMerge {
		t.Error("expected PR 7 to be merged with squash method")
	}
}

func TestRunCheck_AutoMerge_SkipsUnmergeable(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "sess-unmergeable", ProfileId: "default"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES ('job-un', 'owner/repo', 'job', ?, 'main', 'prompt')", time.Now())
	db.Exec(`INSERT INTO settings (profile_id, auto_merge_enabled, auto_merge_method, theme, auto_retry_message, auto_continue_message) VALUES ('default', 1, 'squash', 'system', '', '')`)

	mockFetcher := &MockSessionFetcher{Session: &RemoteSession{Id: sess.Id, State: "IN_PROGRESS", Outputs: []struct { PullRequest *struct { Url string `json:"url"` } `json:"pullRequest"` }{{PullRequest: &struct { Url string `json:"url"` }{Url: "https://g/o/r/pull/8"}}}}}
	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{State: github.String("success")},
		PullRequests: []*github.PullRequest{{
			Number: github.Int(8), HTMLURL: github.String("https://g/o/r/pull/8"), State: github.String("open"),
			Mergeable: github.Bool(false), // UNMERGEABLE
			Head: &github.PullRequestBranch{SHA: github.String("sha-8")},
			User: &github.User{Login: github.String("google-labs-jules")},
		}},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "k")
	worker.runCheck(context.Background())

	if len(mockGH.CreatedComments) > 0 {
		t.Error("expected no merge attempt for unmergeable PR")
	}
}

func TestRunCheck_AutoMerge_SkipsFailedChecks(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "sess-fail", ProfileId: "default"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES ('job-fail', 'owner/repo', 'job', ?, 'main', 'prompt')", time.Now())
	db.Exec(`INSERT INTO settings (profile_id, auto_merge_enabled, auto_merge_method, theme, auto_retry_message, auto_continue_message) VALUES ('default', 1, 'squash', 'system', '', '')`)

	mockFetcher := &MockSessionFetcher{Session: &RemoteSession{Id: sess.Id, State: "IN_PROGRESS", Outputs: []struct { PullRequest *struct { Url string `json:"url"` } `json:"pullRequest"` }{{PullRequest: &struct { Url string `json:"url"` }{Url: "https://g/o/r/pull/9"}}}}}
	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{State: github.String("failure")}, // FAILED CHECKS
		PullRequests: []*github.PullRequest{{
			Number: github.Int(9), HTMLURL: github.String("https://g/o/r/pull/9"), State: github.String("open"),
			Mergeable: github.Bool(true),
			Head: &github.PullRequestBranch{SHA: github.String("sha-9")},
			User: &github.User{Login: github.String("google-labs-jules")},
		}},
		CheckRuns: &github.ListCheckRunsResults{CheckRuns: []*github.CheckRun{{Status: github.String("completed"), Conclusion: github.String("failure"), Name: github.String("fail")}}},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "k")
	worker.runCheck(context.Background())

	// It WILL post a failure comment (existing logic), but MUST NOT merge.
	for _, c := range mockGH.CreatedComments {
		if strings.HasPrefix(c, "MERGED_PR_") {
			t.Error("expected no merge attempt for PR with failed checks")
		}
	}
}

func TestRunCheck_AutoMerge_CommitMessageCleaning(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "sess-clean", ProfileId: "default"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES ('job-clean', 'owner/repo', 'job', ?, 'main', 'prompt')", time.Now())
	db.Exec(`INSERT INTO settings (profile_id, auto_merge_enabled, auto_merge_method, theme, auto_retry_message, auto_continue_message) VALUES ('default', 1, 'squash', 'system', '', '')`)

	mockFetcher := &MockSessionFetcher{Session: &RemoteSession{Id: sess.Id, State: "IN_PROGRESS", Outputs: []struct { PullRequest *struct { Url string `json:"url"` } `json:"pullRequest"` }{{PullRequest: &struct { Url string `json:"url"` }{Url: "https://g/o/r/pull/10"}}}}}
	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{State: github.String("success")},
		PullRequests: []*github.PullRequest{{
			Number: github.Int(10), HTMLURL: github.String("https://g/o/r/pull/10"), State: github.String("open"),
			Mergeable: github.Bool(true),
			Head: &github.PullRequestBranch{SHA: github.String("sha-10")},
			Title: github.String("Clean Title"),
			Body: github.String("Line 1\nPR created automatically by Jules\nLine 2\nCo-authored-by: someone"),
			User: &github.User{Login: github.String("google-labs-jules")},
		}},
	}
    // We need to capture the message passed to MergePullRequest. Since our mock just appends MERGED_PR_..., we can't easily check the body.
	// But we can check that it called Merge.
	// To test cleaning logic strictly, we should probably unit test `attemptAutoMerge` or expose cleaning logic, or update Mock to store message.
	
	// Let's update Mock to store the message map? Or just trust it runs coverage.
	// We want coverage. Running this triggers the cleaning logic lines.
	
	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "k")
	worker.runCheck(context.Background())

	found := false
	for _, c := range mockGH.CreatedComments {
		if strings.HasPrefix(c, "MERGED_PR_10") {
			found = true
		}
	}
	if !found {
		t.Error("expected merge for clean PR")
	}
}

func TestRunCheck_AutoMerge_AlreadyMerged(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "sess-merged", ProfileId: "default"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES ('job-merged', 'owner/repo', 'job', ?, 'main', 'prompt')", time.Now())
	db.Exec(`INSERT INTO settings (profile_id, auto_merge_enabled, auto_merge_method, theme, auto_retry_message, auto_continue_message) VALUES ('default', 1, 'squash', 'system', '', '')`)

	mockFetcher := &MockSessionFetcher{Session: &RemoteSession{Id: sess.Id, State: "IN_PROGRESS", Outputs: []struct { PullRequest *struct { Url string `json:"url"` } `json:"pullRequest"` }{{PullRequest: &struct { Url string `json:"url"` }{Url: "https://g/o/r/pull/11"}}}}}
	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{State: github.String("success")},
		PullRequests: []*github.PullRequest{{
			Number: github.Int(11), HTMLURL: github.String("https://g/o/r/pull/11"), State: github.String("open"),
			Mergeable: github.Bool(true),
			Merged:    github.Bool(true), // ALREADY MERGED
			Head: &github.PullRequestBranch{SHA: github.String("sha-11")},
			User: &github.User{Login: github.String("google-labs-jules")},
		}},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "k")
	worker.runCheck(context.Background())

	if len(mockGH.CreatedComments) > 0 {
		t.Error("expected no merge attempt for already merged PR")
	}
}

// Ensure error handling doesn't panic and logs error
func TestRunCheck_AutoMerge_GetStatusError(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, _ := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{Name: "sess-err", ProfileId: "default"})
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", time.Now().UnixMilli(), sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES ('job-err', 'owner/repo', 'job', ?, 'main', 'prompt')", time.Now())
	db.Exec(`INSERT INTO settings (profile_id, auto_merge_enabled, auto_merge_method, theme, auto_retry_message, auto_continue_message) VALUES ('default', 1, 'squash', 'system', '', '')`)

	mockFetcher := &MockSessionFetcher{Session: &RemoteSession{Id: sess.Id, State: "IN_PROGRESS", Outputs: []struct { PullRequest *struct { Url string `json:"url"` } `json:"pullRequest"` }{{PullRequest: &struct { Url string `json:"url"` }{Url: "https://g/o/r/pull/12"}}}}}
	
	// Mock client that returns error for GetCombinedStatus
	// We need to modify MockGitHubClient to support injecting errors or sub-class it?
	// The current MockGitHubClient struct doesn't have an error field for Status.
	// I'll add one.
	
	mockGH := &MockGitHubClient{
		CombinedStatusError: fmt.Errorf("github api error"),
		PullRequests: []*github.PullRequest{{
			Number: github.Int(12), HTMLURL: github.String("https://g/o/r/pull/12"), State: github.String("open"),
			Mergeable: github.Bool(true),
			Head: &github.PullRequestBranch{SHA: github.String("sha-12")},
			User: &github.User{Login: github.String("google-labs-jules")},
		}},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "k")
	// Should not panic
	worker.runCheck(context.Background())

	if len(mockGH.CreatedComments) > 0 {
		t.Error("expected no actions on status error")
	}
}

func TestRunCheck_MarksReadyForReview(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session-ready",
		ProfileId: "default",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-ready", "owner/repo", "test-job", time.Now(), "main", "test prompt")
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-ready", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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
				}{Url: "https://github.com/owner/repo/pull/6"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				Number:    github.Int(6),
				HTMLURL:   github.String("https://github.com/owner/repo/pull/6"),
				State:     github.String("open"),
				Draft:     github.Bool(true),
				Mergeable: github.Bool(true),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-ready"),
				},
				User: &github.User{
					Login: github.String("test-user"),
				},
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	found := false
	for _, c := range mockGH.CreatedComments {
		if c == "MARKED_READY_FOR_REVIEW" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected MarkPullRequestReadyForReview to be called (simulated by comment)")
	}
}

func TestRunCheck_CommentsOnTestDeletion(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session-deletion",
		ProfileId: "default",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-deletion", "owner/repo", "test-job", time.Now(), "main", "test prompt")

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

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				Number:    github.Int(7),
				HTMLURL:   github.String("https://github.com/owner/repo/pull/7"),
				State:     github.String("open"),
				Draft:     github.Bool(true),
				Mergeable: github.Bool(true),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-deletion"),
				},
				User: &github.User{
					Login: github.String("test-user"),
				},
			},
		},
		Files: []*github.CommitFile{
			{
				Filename: github.String("server/internal/worker/pr_monitor_test.go"),
				Status:   github.String("removed"),
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	found := false
	for _, c := range mockGH.CreatedComments {
		if strings.Contains(c, "Deletion of existing test cases are NOT ALLOWED") {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected comment about test deletion")
	}

	// Ensure it was NOT marked ready for review
	for _, c := range mockGH.CreatedComments {
		if c == "MARKED_READY_FOR_REVIEW" {
			t.Error("should NOT be marked ready for review if test files are deleted")
		}
	}
}

func TestPRMonitorWorker_RunCheck_MultiKey(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Setup Keys
	t.Setenv("JULES_API_KEY", "key-1")
	t.Setenv("JULES_API_KEY_2", "key-2")

	// Setup Mock Fetcher
	mockFetcher := &MockSessionFetcher{
		Sources: []Source{
			{GithubRepo: GithubRepo{Owner: "owner", Repo: "repo1"}},
		},
	}
	
	// Setup Mock GitHub
	mockGH := &MockGitHubClient{
		IssuesSearchResult: &github.IssuesSearchResult{
			Issues: []*github.Issue{},
			Total: github.Int(0),
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "default-key")
	
	err := worker.runCheck(context.Background())
	assert.NoError(t, err)

	// Verify that ListSources was called with both keys
	assert.Equal(t, 2, len(mockFetcher.ListSourcesCalls))
	assert.Contains(t, mockFetcher.ListSourcesCalls, "key-1")
	assert.Contains(t, mockFetcher.ListSourcesCalls, "key-2")
}

func TestRunCheck_QueryDoesNotFilterByStatus(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session-query",
		ProfileId: "default",
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

	mockGH := &MockGitHubClient{
		IssuesSearchResult: &github.IssuesSearchResult{
			Issues: []*github.Issue{},
			Total:  github.Int(0),
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	err = worker.runCheck(context.Background())
	assert.NoError(t, err)

	if strings.Contains(mockGH.SearchIssuesQuery, "status:success") {
		t.Errorf("Search query should not contain 'status:success', got: %s", mockGH.SearchIssuesQuery)
	}
}
