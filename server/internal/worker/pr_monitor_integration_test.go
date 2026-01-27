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

	t.Run("Report failure even if pending checks exist", func(t *testing.T) {
		mockGH.CreatedComments = nil
		mockGH.Comments = nil
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

		// Fail Fast: Expect 1 comment
		if len(mockGH.CreatedComments) != 1 {
			t.Fatalf("expected 1 comment (fail fast), got %d", len(mockGH.CreatedComments))
		}
	})

	t.Run("Comment when all checks done and failed (Status: failure)", func(t *testing.T) {
		mockGH.CreatedComments = nil
		mockGH.Comments = nil
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
			t.Fatalf("expected 1 comment, got %d", len(mockGH.CreatedComments))
		}

		// Verify body contains both checks
		expectedBody := failureCommentPrefix + "\n- check-1\n- legacy-check\n\n@jules"
		// Order might vary if map iteration is random?
		// Logic uses slice append?
		// "failingCheckNames = append... check runs... then statuses". Order preserved.
		// "distinctNames" uses map for uniqueness BUT iteration over `failingCheckNames` preserves order.
		// `failingCheckNames` checks `allCheckRuns` then `combinedStatus.Statuses`.
		// So `check-1` then `legacy-check`.
		// However, `allCheckRuns` order depends on mock setup.
		if mockGH.CreatedComments[0] != expectedBody {
			t.Errorf("unexpected comment body.\nExpected:\n%s\nGot:\n%s", expectedBody, mockGH.CreatedComments[0])
		}
	})

	t.Run("Skip if bot's failure comment is already the last comment", func(t *testing.T) {
		mockGH.CreatedComments = nil
		mockGH.Comments = []*github.IssueComment{
			{
				User: &github.User{Login: github.String("google-labs-jules")},
				Body: github.String(failureCommentPrefix + "\n- check-1\n- legacy-check\n\n@jules"),
			},
		}
		// logic uses mockGH.CheckRuns from previous step? Yes, shared mock.

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		// Now we expect 0 comments because it skipped
		if len(mockGH.CreatedComments) != 0 {
			t.Errorf("expected 0 comments (skipped redundant), got %d", len(mockGH.CreatedComments))
		}
	})

	t.Run("Yield if human intervenes", func(t *testing.T) {
		mockGH.CreatedComments = nil
		mockGH.Comments = append(mockGH.Comments, &github.IssueComment{
			User: &github.User{Login: github.String("human-user")},
			Body: github.String("I'm fixing this now."),
		})

		err := worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		if len(mockGH.CreatedComments) != 0 {
			t.Errorf("expected 0 comments (yielded/skipped due to identical failure despite human), got %d", len(mockGH.CreatedComments))
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
			t.Fatalf("expected 1 comment (handled pending status with completed failure), got %d", len(mockGH.CreatedComments))
		}

		// Verify comment
		commentBody := mockGH.CreatedComments[0]
		if !strings.Contains(commentBody, "The following github action checks are failing") {
			t.Errorf("comment body missing 'The following github action checks are failing' prefix. Got:\n%s", commentBody)
		}
		if !strings.Contains(commentBody, "check-fail") {
			t.Errorf("comment body missing failing check name 'check-fail'")
		}
		if strings.Contains(commentBody, "check-pass") {
			t.Errorf("comment body should not contain passing check name 'check-pass'")
		}
	})
	t.Run("Stale PR Logic", func(t *testing.T) {
		// Mock PRs
		conflictStale := time.Now().AddDate(0, 0, -4) // > 3 days
		conflictFresh := time.Now().AddDate(0, 0, -2) // < 3 days
		failingStale := time.Now().AddDate(0, 0, -6)  // > 5 days
		failingFresh := time.Now().AddDate(0, 0, -4)  // < 5 days

		mockGH.PullRequests = []*github.PullRequest{
			{Number: github.Int(10), HTMLURL: github.String("http://10"), UpdatedAt: &github.Timestamp{Time: conflictStale}, Mergeable: github.Bool(false), User: &github.User{Login: github.String("u")}},
			{Number: github.Int(11), HTMLURL: github.String("http://11"), UpdatedAt: &github.Timestamp{Time: conflictFresh}, Mergeable: github.Bool(false), User: &github.User{Login: github.String("u")}},
			{Number: github.Int(12), HTMLURL: github.String("http://12"), CreatedAt: &github.Timestamp{Time: failingStale}, UpdatedAt: &github.Timestamp{Time: failingStale}, Head: &github.PullRequestBranch{SHA: github.String("sha-stale")}, User: &github.User{Login: github.String("u")}},
			{Number: github.Int(13), HTMLURL: github.String("http://13"), CreatedAt: &github.Timestamp{Time: failingFresh}, UpdatedAt: &github.Timestamp{Time: failingFresh}, Head: &github.PullRequestBranch{SHA: github.String("sha-fresh")}, User: &github.User{Login: github.String("u")}},
		}

		// Combined Status mocks
		mockGH.CombinedStatus = &github.CombinedStatus{State: github.String("failure")} // For simplicity, all return failure for now, logic checks SHA
		// But Wait, runCheck iterates PRs. GetCombinedStatus is called with SHA.
		// We need MockGitHubClient to return failure for specific SHAs?
		// The current mock implementation likely returns the SAME status for all calls unless we modify it.
		// Let's assume it returns what is set in mockGH.CombinedStatus.
		// So all PRs with Head will see failure.

		// Reset
		mockGH.CreatedComments = nil
		mockGH.Comments = nil
		// Enable Stale Check in settings
		// We insert a row to ensure it exists, including nullable text fields
		_, err = db.Exec(`INSERT INTO settings (id, auto_close_stale_conflicted_prs, stale_conflicted_prs_duration_days, theme, auto_retry_message, auto_continue_message) 
			VALUES (1, 1, 3, 'light', '', '') 
			ON CONFLICT(id) DO UPDATE SET 
			auto_close_stale_conflicted_prs = 1, 
			stale_conflicted_prs_duration_days = 3`)
		if err != nil {
			t.Fatalf("failed to update settings: %v", err)
		}

		err = worker.runCheck(context.Background())
		if err != nil {
			t.Errorf("runCheck failed: %v", err)
		}

		// Expect PR 10 (Conflict Stale) to be closed/commented
		// Expect PR 12 (Failing Stale) to be closed/commented
		// Expect PR 11 (Conflict Fresh) to be skipped
		// Expect PR 13 (Failing Fresh) to be skipped

		closedCount := 0
		for _, comment := range mockGH.CreatedComments {
			if strings.Contains(comment, "Closing stale PR") {
				closedCount++
			}
		}

		if closedCount != 2 {
			t.Errorf("Expected 2 stale PRs to be closed, got %d. Comments: %v", closedCount, mockGH.CreatedComments)
			// Debug
			for _, c := range mockGH.CreatedComments {
				t.Logf("Comment: %s", c)
			}
		}
	})
}
