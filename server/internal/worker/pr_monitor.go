package worker

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gammazero/workerpool"
	"github.com/google/go-github/v69/github"
	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

const failureCommentPrefix = "The following github action checks are failing. Please review the code and fix the program or the test. Make sure ALL operations in github actions MUST PASS 100%"

type GitHubClient interface {
	GetCombinedStatus(ctx context.Context, owner, repo, ref string) (*github.CombinedStatus, error)
	ListPullRequests(ctx context.Context, owner, repo string, opts *github.PullRequestListOptions) ([]*github.PullRequest, error)
	GetPullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, *github.Response, error)
	ListCheckRunsForRef(ctx context.Context, owner, repo, ref string, opts *github.ListCheckRunsOptions) (*github.ListCheckRunsResults, *github.Response, error)
	ListComments(ctx context.Context, owner, repo string, number int) ([]*github.IssueComment, error)
	CreateComment(ctx context.Context, owner, repo string, number int, body string) error
	GetUser(ctx context.Context, username string) (*github.User, error)
	ClosePullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error)
	UpdateBranch(ctx context.Context, owner, repo string, number int) error
	MarkPullRequestReadyForReview(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error)
	ListFiles(ctx context.Context, owner, repo string, number int, opts *github.ListOptions) ([]*github.CommitFile, error)
}

type PRMonitorWorker struct {
	BaseWorker
	id              string
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer
	githubClient    GitHubClient
	pool            *workerpool.WorkerPool
}

func NewPRMonitorWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer, gh GitHubClient, fetcher interface{}, apiKey string) *PRMonitorWorker {
	// fetcher and apiKey are no longer needed
	return &PRMonitorWorker{
		BaseWorker: BaseWorker{
			NameStr:  "PRMonitorWorker",
			Interval: 300 * time.Second,
		},
		id:              uuid.New().String()[:8],
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		githubClient:    gh,
		pool:            GetPoolFactory().NewPool(5),
	}
}

func (w *PRMonitorWorker) Start(ctx context.Context) error {
	logger.Info("%s [%s] starting...", w.Name(), w.id)

	for {
		interval := w.getInterval(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			status := "Success"
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s [%s] check failed: %s", w.Name(), w.id, err.Error())
				status = "Failed"
			}
			nextInterval := w.getInterval(ctx)
			nextRun := time.Now().Add(nextInterval)
			logger.Info("%s [%s] task completed. Status: %s. Next run at %s", w.Name(), w.id, status, nextRun.Format(time.RFC3339))
		}
	}
}

func (w *PRMonitorWorker) getInterval(ctx context.Context) time.Duration {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err == nil {
		if s.PrStatusPollInterval > 0 {
			return time.Duration(s.PrStatusPollInterval) * time.Second
		}
	}
	return 300 * time.Second
}

func (w *PRMonitorWorker) runCheck(ctx context.Context) error {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	if !s.CheckFailingActionsEnabled {
		return nil
	}

	// List distinct repos from jobs
	rows, err := w.db.QueryContext(ctx, "SELECT DISTINCT repo FROM jobs WHERE repo IS NOT NULL AND repo != ''")
	if err != nil {
		return err
	}
	defer rows.Close()

	var repos []string
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			continue
		}
		repos = append(repos, r)
	}
	rows.Close()

	if len(repos) == 0 {
		return nil
	}

	logger.Info("%s [%s]: Found %d repos to check", w.Name(), w.id, len(repos))

	var wg sync.WaitGroup
	for _, r := range repos {
		wg.Add(1)
		repoFullName := r
		w.pool.Submit(func() {
			defer wg.Done()
			w.checkRepo(ctx, repoFullName, s)
		})
	}

	wg.Wait()
	return nil
}

func (w *PRMonitorWorker) checkRepo(ctx context.Context, repoFullName string, s *pb.Settings) {
	parts := strings.Split(repoFullName, "/")
	if len(parts) != 2 {
		logger.Error("%s [%s]: Invalid repo name %s", w.Name(), w.id, repoFullName)
		return
	}
	owner, repo := parts[0], parts[1]

	// List open PRs
	opts := &github.PullRequestListOptions{
		State: "open",
		ListOptions: github.ListOptions{
			PerPage: 50,
		},
	}
	prs, err := w.githubClient.ListPullRequests(ctx, owner, repo, opts)
	if err != nil {
		logger.Error("%s [%s]: Failed to list PRs for %s: %v", w.Name(), w.id, repoFullName, err)
		return
	}

	logger.Info("%s [%s]: Found %d open PRs in %s", w.Name(), w.id, len(prs), repoFullName)

	for _, pr := range prs {
		if pr == nil || pr.Number == nil || pr.HTMLURL == nil || pr.User == nil || pr.User.Login == nil {
			continue
		}

		// 0. Check for zero changes
		if pr.ChangedFiles != nil && *pr.ChangedFiles == 0 {
			logger.Info("%s [%s]: Closing PR %s because it has 0 changed files", w.Name(), w.id, *pr.HTMLURL)
			if _, err := w.githubClient.ClosePullRequest(ctx, owner, repo, *pr.Number); err != nil {
				logger.Error("%s [%s]: Failed to close PR %s: %v", w.Name(), w.id, *pr.HTMLURL, err)
			}
			continue
		}

		// 0.5 Check for Stale PRs (Conflict OR Failing)
		// Condition: UpdatedAt > Threshold AND (Mergeable == false OR Status == failure)
		if s.AutoCloseStaleConflictedPrs {
			days := 5
			if s.StaleConflictedPrsDurationDays > 0 {
				days = int(s.StaleConflictedPrsDurationDays)
			}
			threshold := time.Now().AddDate(0, 0, -days)

			if pr.UpdatedAt != nil && pr.UpdatedAt.Before(threshold) {
				isStale := false
				reason := ""

				// Check Conflict
				if pr.Mergeable != nil && !*pr.Mergeable {
					isStale = true
					reason = "it has merge conflicts"
				}

				// Check Status (if not already stale by conflict)
				if !isStale && pr.Head != nil && pr.Head.SHA != nil {
					status, err := w.githubClient.GetCombinedStatus(ctx, owner, repo, *pr.Head.SHA)
					if err == nil && status != nil && status.State != nil && *status.State == "failure" {
						isStale = true
						reason = "it has failing checks"
					}
				}

				if isStale {
					logger.Info("%s [%s]: Closing stale PR %s because %s", w.Name(), w.id, *pr.HTMLURL, reason)
					msg := fmt.Sprintf("Closing stale PR because it hasn't been updated for %d days and %s. Please update the branch or fix issues to reopen.", days, reason)

					if err := w.githubClient.CreateComment(ctx, owner, repo, *pr.Number, msg); err != nil {
						logger.Error("%s [%s]: Failed to comment on stale PR %s: %v", w.Name(), w.id, *pr.HTMLURL, err)
					}

					if _, err := w.githubClient.ClosePullRequest(ctx, owner, repo, *pr.Number); err != nil {
						logger.Error("%s [%s]: Failed to close stale PR %s: %v", w.Name(), w.id, *pr.HTMLURL, err)
					}
					continue
				}
			}
		}

		// 1. Check for test file deletions (Applies to everyone)
		deleted, err := w.checkTestDeletion(ctx, owner, repo, *pr.Number, *pr.HTMLURL)
		if err != nil {
			logger.Error("%s: Failed to check test deletion for %s: %v", w.Name(), *pr.HTMLURL, err)
		}
		if deleted {
			continue
		}

		isBot := strings.Contains(*pr.User.Login, "google-labs-jules")

		// 2. Check for Auto-Ready (Applicable if checks passed)
		w.checkAutoReady(ctx, owner, repo, *pr.Number, *pr.HTMLURL, pr)

		// 3. Check Status and Actions (Update Branch for Bot, Comment for Failure)
		w.checkPRStatus(ctx, owner, repo, *pr.Number, *pr.HTMLURL, pr.Head, isBot)
	}
}

func (w *PRMonitorWorker) checkTestDeletion(ctx context.Context, owner, repo string, number int, prUrl string) (bool, error) {
	files, err := w.githubClient.ListFiles(ctx, owner, repo, number, nil)
	if err != nil {
		return false, err
	}

	for _, file := range files {
		if file.Status != nil && *file.Status == "removed" && file.Filename != nil {
			name := *file.Filename
			if strings.HasSuffix(name, "_test.go") ||
				strings.HasSuffix(name, ".test.ts") ||
				strings.HasSuffix(name, ".spec.ts") ||
				strings.Contains(name, "/tests/") ||
				strings.HasPrefix(name, "tests/") {

				msg := "Deletion of existing test cases are NOT ALLOWED. Only refactoring and move of these test cases are allowed"
				logger.Info("%s: Found deleted test file %s in %s. Commenting.", w.Name(), name, prUrl)

				// Check for duplicates
				comments, err := w.githubClient.ListComments(ctx, owner, repo, number)
				if err != nil {
					return true, err
				}

				alreadyCommented := false
				if len(comments) > 0 {
					lastComment := comments[len(comments)-1]
					if lastComment.Body != nil && strings.Contains(*lastComment.Body, "Deletion of existing test cases are NOT ALLOWED") {
						alreadyCommented = true
					}
				}

				if !alreadyCommented {
					if err := w.githubClient.CreateComment(ctx, owner, repo, number, msg); err != nil {
						logger.Error("%s: Failed to create test deletion comment on %s: %v", w.Name(), prUrl, err)
					}
				}
				return true, nil
			}
		}
	}
	return false, nil
}

func (w *PRMonitorWorker) checkAutoReady(ctx context.Context, owner, repo string, number int, prUrl string, pr *github.PullRequest) {
	if pr.Head == nil || pr.Head.SHA == nil {
		return
	}
	// Check Status
	combinedStatus, err := w.githubClient.GetCombinedStatus(ctx, owner, repo, *pr.Head.SHA)
	if err != nil {
		logger.Error("%s: Failed to get status for %s: %v", w.Name(), prUrl, err)
		return
	}

	if combinedStatus != nil && combinedStatus.State != nil && *combinedStatus.State == "success" {
		if pr.Mergeable != nil && *pr.Mergeable && pr.Draft != nil && *pr.Draft {
			logger.Info("%s: PR %s is passed and mergeable. Marking ready for review.", w.Name(), prUrl)
			if _, err := w.githubClient.MarkPullRequestReadyForReview(ctx, owner, repo, number); err != nil {
				logger.Error("%s: Failed to mark PR %s ready for review: %v", w.Name(), prUrl, err)
			}
		}
	}
}

func (w *PRMonitorWorker) checkPRStatus(ctx context.Context, owner, repo string, number int, prUrl string, head *github.PullRequestBranch, isBot bool) {
	if head == nil || head.SHA == nil {
		logger.Error("%s [%s]: PR %s has no Head/SHA", w.Name(), w.id, prUrl)
		return
	}

	combinedStatus, err := w.githubClient.GetCombinedStatus(ctx, owner, repo, *head.SHA)
	if err != nil {
		logger.Error("%s [%s]: Failed to get status for %s: %v", w.Name(), w.id, prUrl, err)
		return
	}
	if combinedStatus == nil {
		logger.Error("%s [%s]: Combined status is nil for %s", w.Name(), w.id, prUrl)
		return
	}

	if combinedStatus.State == nil {
		logger.Info("%s [%s]: PR %s status state is nil", w.Name(), w.id, prUrl)
		return
	}

	// Detailed logging
	logger.Info("%s [%s]: Checked PR %s. Status: %s", w.Name(), w.id, prUrl, *combinedStatus.State)

	if *combinedStatus.State == "failure" || *combinedStatus.State == "pending" {
		// Check if ANY check run is pending/in_progress.
		opts := &github.ListCheckRunsOptions{ListOptions: github.ListOptions{PerPage: 100}}
		var allCheckRuns []*github.CheckRun
		for {
			runs, resp, err := w.githubClient.ListCheckRunsForRef(ctx, owner, repo, *head.SHA, opts)
			if err != nil {
				logger.Error("%s [%s]: Failed to list check runs for %s: %v", w.Name(), w.id, prUrl, err)
				return
			}
			if runs != nil {
				allCheckRuns = append(allCheckRuns, runs.CheckRuns...)
			}
			if resp.NextPage == 0 {
				break
			}
			opts.Page = resp.NextPage
		}

		for _, run := range allCheckRuns {
			if run.Status != nil && (*run.Status == "queued" || *run.Status == "in_progress") {
				logger.Info("%s [%s]: PR %s has pending check run: %s (%s). Waiting.", w.Name(), w.id, prUrl, run.GetName(), *run.Status)
				return
			}
		}

		// If pending, check if there is an actual failure
		if *combinedStatus.State == "pending" {
			hasFailure := false
			for _, run := range allCheckRuns {
				if run.Conclusion != nil && (*run.Conclusion == "failure" || *run.Conclusion == "timed_out" || *run.Conclusion == "cancelled") {
					hasFailure = true
					break
				}
			}
			if !hasFailure {
				return
			}
			logger.Info("%s [%s]: PR %s is pending but has failed check runs. Treating as failure.", w.Name(), w.id, prUrl)
		}

		// Update Branch logic (BOT ONLY)
		if isBot {
			fullPR, _, err := w.githubClient.GetPullRequest(ctx, owner, repo, number)
			if err != nil {
				logger.Error("%s [%s]: Failed to get full PR details for %s: %v", w.Name(), w.id, prUrl, err)
			} else {
				if fullPR.MergeableState != nil && *fullPR.MergeableState == "behind" {
					logger.Info("%s [%s]: PR %s is behind base. Attempting to update branch...", w.Name(), w.id, prUrl)
					if err := w.githubClient.UpdateBranch(ctx, owner, repo, number); err != nil {
						logger.Error("%s [%s]: Failed to update branch for %s: %v", w.Name(), w.id, prUrl, err)
					} else {
						logger.Info("%s [%s]: Successfully triggered branch update for %s", w.Name(), w.id, prUrl)
						return
					}
				}
			}
		}

		// Comment on failure (ALL USERS)
		comments, err := w.githubClient.ListComments(ctx, owner, repo, number)
		if err != nil {
			logger.Error("%s [%s]: Failed to list comments for %s: %v", w.Name(), w.id, prUrl, err)
			return
		}

		// Calculate failing check names first to construct message
		var failingCheckNames []string
		for _, run := range allCheckRuns {
			if run.Conclusion != nil && (*run.Conclusion == "failure" || *run.Conclusion == "timed_out" || *run.Conclusion == "cancelled") {
				failingCheckNames = append(failingCheckNames, run.GetName())
			}
		}
		for _, status := range combinedStatus.Statuses {
			if status.State != nil && *status.State == "failure" {
				failingCheckNames = append(failingCheckNames, status.GetContext())
			}
		}

		// Deduplicate failure names
		uniqueNames := make(map[string]bool)
		var distinctNames []string
		for _, name := range failingCheckNames {
			if !uniqueNames[name] {
				uniqueNames[name] = true
				distinctNames = append(distinctNames, name)
			}
		}

		if len(distinctNames) == 0 {
			logger.Info("%s [%s]: No failed checks found for %s despite failure status. Skipping comment.", w.Name(), w.id, prUrl)
			return
		}

		// Construct message
		msg := failureCommentPrefix
		for _, name := range distinctNames {
			msg += "\n- " + name
		}
		sha := *head.SHA
		if len(sha) > 8 {
			sha = sha[:8]
		}
		msg += "\n\n@jules"

		shouldComment := true
		if len(comments) > 0 {
			lastComment := comments[len(comments)-1]
			isLastByBot := lastComment.User != nil && lastComment.User.Login != nil && strings.Contains(*lastComment.User.Login, "google-labs-jules")

			if !isLastByBot {
				logger.Info("%s [%s]: Last comment on PR %s is by Human. Skipping (yielding to human).", w.Name(), w.id, prUrl)
				shouldComment = false
			} else {
				// Last by Bot. Check duplication to avoid exact spam.
				if lastComment.Body != nil && strings.Contains(*lastComment.Body, msg) {
					logger.Info("%s [%s]: Last comment on PR %s is identical to new failure report. Skipping.", w.Name(), w.id, prUrl)
					shouldComment = false
				} else {
					logger.Info("%s [%s]: Last comment on PR %s is by Bot but content differs (or we want to nag). Commenting.", w.Name(), w.id, prUrl)
					// Proceed to comment
				}
			}
		}

		if shouldComment {
			if err := w.githubClient.CreateComment(ctx, owner, repo, number, msg); err != nil {
				logger.Error("%s [%s]: Failed to create comment on %s: %v", w.Name(), w.id, prUrl, err)
			} else {
				logger.Info("%s [%s]: Posted failure comment on %s for commit %s", w.Name(), w.id, prUrl, sha)
			}
		}
	}
}
