package worker

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v69/github"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestAutoMerge_PerformsMerge(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-automerge",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-automerge", "owner/repo", "test-job", time.Now(), "main", "test prompt")

	// Enable Auto Merge
	_, err = db.Exec(`INSERT INTO settings (id, auto_merge_enabled, auto_merge_method, auto_merge_message, theme, auto_retry_message, auto_continue_message) 
		VALUES (1, 1, 'squash', 'Auto-merged!', 'system', '', '') 
		ON CONFLICT(id) DO UPDATE SET 
		auto_merge_enabled = 1, 
		auto_merge_method = 'squash', 
		auto_merge_message = 'Auto-merged!'`)
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
				}{Url: "https://github.com/owner/repo/pull/123"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:          github.String("open"),
				Number:         github.Int(123),
				HTMLURL:        github.String("https://github.com/owner/repo/pull/123"),
				Mergeable:      github.Bool(true),
				MergeableState: github.String("clean"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-automerge"),
					Ref: github.String("branch-automerge"),
				},
				User: &github.User{
					Login: github.String("google-labs-jules"),
				},
				Title: github.String("Test PR"),
				Body:  github.String("Test Body"),
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	// Verify MergePullRequest was called
	foundMerge := false
	for _, c := range mockGH.CreatedComments {
		if strings.Contains(c, "MERGED_PR_123_squash") {
			foundMerge = true
			break
		}
	}

	assert.True(t, foundMerge, "Expected MERGED_PR_123_squash action record")

	// Verify Auto Merge Comment
	foundComment := false
	for _, c := range mockGH.CreatedComments {
		if strings.Contains(c, "Auto-merged!") {
			foundComment = true
			break
		}
	}
	assert.True(t, foundComment, "Expected auto-merge comment")
}

func TestAutoMerge_PerformsMerge_HumanUser(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-automerge-human",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-automerge-human", "owner/repo", "test-job", time.Now(), "main", "test prompt")

	_, err = db.Exec(`INSERT INTO settings (id, auto_merge_enabled, auto_merge_method, auto_merge_message, theme, auto_retry_message, auto_continue_message) 
		VALUES (1, 1, 'squash', 'Auto-merged!', 'system', '', '') 
		ON CONFLICT(id) DO UPDATE SET 
		auto_merge_enabled = 1, 
		auto_merge_method = 'squash', 
		auto_merge_message = 'Auto-merged!'`)
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
				}{Url: "https://github.com/owner/repo/pull/124"}},
			},
		},
	}

	mockGH := &MockGitHubClient{
		CombinedStatus: &github.CombinedStatus{
			State: github.String("success"),
		},
		PullRequests: []*github.PullRequest{
			{
				State:          github.String("open"),
				Number:         github.Int(124),
				HTMLURL:        github.String("https://github.com/owner/repo/pull/124"),
				Mergeable:      github.Bool(true),
				MergeableState: github.String("clean"),
				Head: &github.PullRequestBranch{
					SHA: github.String("sha-automerge-human"),
					Ref: github.String("branch-automerge-human"),
				},
				User: &github.User{
					Login: github.String("regular-human-user"),
				},
				Title: github.String("Human PR"),
				Body:  github.String("Human Body"),
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	foundMerge := false
	for _, c := range mockGH.CreatedComments {
		if strings.Contains(c, "MERGED_PR_124_squash") {
			foundMerge = true
			break
		}
	}
	assert.True(t, foundMerge, "Expected MERGED_PR_124_squash for human user")
}

func TestAutoClose_PerformsClose_HumanUser(t *testing.T) {
	db := setupTestDB(t)
	settingsService := &service.SettingsServer{DB: db}
	sessionService := &service.SessionServer{DB: db}

	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-autoclose-human",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	nowMilli := time.Now().UnixMilli()
	db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_interaction_at = ? WHERE id = ?", nowMilli, sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, branch, prompt) VALUES (?, ?, ?, ?, ?, ?)", "job-autoclose-human", "owner/repo", "test-job", time.Now(), "main", "test prompt")

	// Enable Auto Close on Conflict
	_, err = db.Exec(`INSERT INTO settings (id, auto_close_stale_conflicted_prs, stale_conflicted_prs_duration_days, theme, auto_retry_message, auto_continue_message) 
		VALUES (1, 1, 3, 'system', '', '') 
		ON CONFLICT(id) DO UPDATE SET 
		auto_close_stale_conflicted_prs = 1, 
		stale_conflicted_prs_duration_days = 3`)
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
				}{Url: "https://github.com/owner/repo/pull/125"}},
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
				Number:    github.Int(125),
				HTMLURL:   github.String("https://github.com/owner/repo/pull/125"),
				Mergeable: github.Bool(false), // Conflict!
				// Stale! (> 3 days)
				UpdatedAt: &github.Timestamp{Time: time.Now().AddDate(0, 0, -4)},
				User: &github.User{
					Login: github.String("regular-human-user"),
				},
				Title: github.String("Human Conflict PR"),
			},
		},
	}

	worker := NewPRMonitorWorker(db, settingsService, sessionService, mockGH, mockFetcher, "test-api-key")
	if err := worker.runCheck(context.Background()); err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	if !mockGH.ClosePullRequestCalled {
		t.Error("expected ClosePullRequest to be called for Human Conflict PR")
	}
}
