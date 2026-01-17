package worker

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
)

type MockGitHubClient struct {
	CombinedStatus *github.CombinedStatus
	PullRequests   []*github.PullRequest
	Comments       []*github.IssueComment
	User           *github.User
	CreatedComments []string
    CheckRuns      *github.ListCheckRunsResults
	ClosePullRequestCalled bool
	UpdateBranchCalled     bool
}

func (m *MockGitHubClient) GetCombinedStatus(ctx context.Context, owner, repo, ref string) (*github.CombinedStatus, error) {
	return m.CombinedStatus, nil
}

func (m *MockGitHubClient) ListPullRequests(ctx context.Context, owner, repo string, opts *github.PullRequestListOptions) ([]*github.PullRequest, error) {
	return m.PullRequests, nil
}

func (m *MockGitHubClient) GetPullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, *github.Response, error) {
    // Return first PR for simplicity or match logic
    if len(m.PullRequests) > 0 {
        return m.PullRequests[0], nil, nil
    }
    return nil, nil, nil
}

func (m *MockGitHubClient) ListCheckRunsForRef(ctx context.Context, owner, repo, ref string, opts *github.ListCheckRunsOptions) (*github.ListCheckRunsResults, *github.Response, error) {
    return m.CheckRuns, nil, nil
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

type MockSessionFetcher struct {
	Session *RemoteSession
    Err     error
}

func (m *MockSessionFetcher) GetSession(ctx context.Context, id, apiKey string) (*RemoteSession, error) {
	return m.Session, m.Err
}

func TestRunCheck_CommentsOnFailure(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	// Create a session in DB
	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session",

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
				{Status: github.String("completed"), Conclusion: github.String("failure")},
			},
		},
		PullRequests: []*github.PullRequest{
			{
				State:   github.String("open"),
				Number:  github.Int(1),
				HTMLURL: github.String("https://github.com/owner/repo/pull/1"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha123"),
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
    
    // Verify comment created
    if len(mockGH.CreatedComments) != 1 {
        t.Errorf("expected 1 comment, got %d", len(mockGH.CreatedComments))
    }
    
    // Run again, should NOT comment again if last comment is ours (simulated logic needed)
    
    // Update MockGH to return the comment we just "created"
    mockGH.Comments = []*github.IssueComment{
        {
			User: &github.User{Login: github.String("google-labs-jules")},
            Body: github.String("Checks failed"), // or whatever message we choose
        },
    }
    
     err = worker.runCheck(context.Background())
    if err != nil {
        t.Errorf("runCheck failed: %v", err)
    }
    
    if len(mockGH.CreatedComments) != 1 {
        t.Errorf("expected still 1 comment after second run, got %d", len(mockGH.CreatedComments))
    }
}

func TestRunCheck_SkipsIfPending(t *testing.T) {
    db := setupTestDB(t)
    settingsService := &service.SettingsServer{DB: db}
    sessionService := &service.SessionServer{DB: db}

    // Create a session in DB
    sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
        Name:      "test-session-pending",
        
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
                {Status: github.String("completed"), Conclusion: github.String("failure")},
                {Status: github.String("in_progress")}, // Pending check!
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
    
    // Should NOT comment because one check is in_progress
    if len(mockGH.CreatedComments) != 0 {
        t.Errorf("expected 0 comments (pending check), got %d", len(mockGH.CreatedComments))
    }
}

func TestRunCheck_NoCommentIfPassing(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session-passing",

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
				{PullRequest: &struct{ Url string `json:"url"` }{Url: "https://github.com/owner/repo/pull/3"}},
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
		Name:      "test-session-invalid",

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
				{PullRequest: &struct{ Url string `json:"url"` }{Url: "https://gitlab.com/owner/repo/pull/4"}}, // Invalid domain
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
		Name:      "test-session-zero-changes",

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
				{PullRequest: &struct{ Url string `json:"url"` }{Url: "https://github.com/owner/repo/pull/5"}},
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

func TestRunCheck_UpdatesBranchIfBehind(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name:      "test-session-behind",

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
				{PullRequest: &struct{ Url string `json:"url"` }{Url: "https://github.com/owner/repo/pull/6"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("failure"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:          github.String("open"),
				Number:         github.Int(6),
				HTMLURL:        github.String("https://github.com/owner/repo/pull/6"),
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
