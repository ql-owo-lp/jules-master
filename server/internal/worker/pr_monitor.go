package worker

import (
	"context"
	"database/sql"
	"strings"
	"sync" // Added sync
	"time"

	"github.com/gammazero/workerpool"
	"github.com/google/go-github/v69/github"
	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
)

const failureCommentPrefix = "The following github action checks are failing. Please review the code and fix the program or the test."

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
}

type PRMonitorWorker struct {
	BaseWorker
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
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		githubClient:    gh,
		pool:            GetPoolFactory().NewPool(5),
	}
}

func (w *PRMonitorWorker) Start(ctx context.Context) error {
	logger.Info("%s starting...", w.Name())

	for {
		interval := w.getInterval(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(interval):
			status := "Success"
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s check failed: %s", w.Name(), err.Error())
				status = "Failed"
			}
			nextInterval := w.getInterval(ctx)
			nextRun := time.Now().Add(nextInterval)
			logger.Info("%s task completed. Status: %s. Next run at %s", w.Name(), status, nextRun.Format(time.RFC3339))
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
	// This ensures we only check repos we are actively working on / have worked on.
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

	logger.Info("%s: Found %d repos to check", w.Name(), len(repos))

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
		logger.Error("%s: Invalid repo name %s", w.Name(), repoFullName)
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
		logger.Error("%s: Failed to list PRs for %s: %v", w.Name(), repoFullName, err)
		return
	}

	logger.Info("%s: Found %d open PRs in %s", w.Name(), len(prs), repoFullName)

	for _, pr := range prs {
		if pr == nil || pr.Number == nil || pr.HTMLURL == nil {
			continue
		}

		// Filter by author "google-labs-jules" (checking prefix to handle [bot] suffix)
		if pr.User == nil || pr.User.Login == nil || !strings.Contains(*pr.User.Login, "google-labs-jules") {
			// Uncomment for verbose debugging if needed, but keeping it quiet for now to avoid spam
			// logger.Info("%s: Skipping PR %s by author %s", w.Name(), *pr.HTMLURL, *pr.User.Login)
			continue
		}

		// Close empty PRs
		if pr.ChangedFiles != nil && *pr.ChangedFiles == 0 {
			logger.Info("%s: Closing PR %s because it has 0 changed files", w.Name(), *pr.HTMLURL)
			if _, err := w.githubClient.ClosePullRequest(ctx, owner, repo, *pr.Number); err != nil {
				logger.Error("%s: Failed to close PR %s: %v", w.Name(), *pr.HTMLURL, err)
			}
			continue
		}

		w.checkPR(ctx, owner, repo, *pr.Number, *pr.HTMLURL, pr.Head, s)
	}
}

func (w *PRMonitorWorker) checkPR(ctx context.Context, owner, repo string, number int, prUrl string, head *github.PullRequestBranch, s *pb.Settings) {
	if head == nil || head.SHA == nil {
		logger.Error("%s: PR %s has no Head/SHA", w.Name(), prUrl)
		return
	}

	// Check Status
	combinedStatus, err := w.githubClient.GetCombinedStatus(ctx, owner, repo, *head.SHA)
	if err != nil {
		logger.Error("%s: Failed to get status for %s: %v", w.Name(), prUrl, err)
		return
	}
	if combinedStatus == nil {
		logger.Error("%s: Combined status is nil for %s", w.Name(), prUrl)
		return
	}

	if combinedStatus.State == nil {
		logger.Info("%s: PR %s status state is nil", w.Name(), prUrl)
		return
	}

	// Detailed logging as requested
	// Detailed logging as requested
	logger.Info("%s: Checked PR %s (author: google-labs-jules). Status: %s", w.Name(), prUrl, *combinedStatus.State)

	// If status is failure OR pending, we check deeper.
	// Pending checks might have individual failed runs (fail fast).
	if *combinedStatus.State == "failure" || *combinedStatus.State == "pending" {

		// Check if ANY check run is pending/in_progress.
		checkRuns, _, err := w.githubClient.ListCheckRunsForRef(ctx, owner, repo, *head.SHA, nil)
		if err != nil {
			logger.Error("%s: Failed to list check runs for %s: %v", w.Name(), prUrl, err)
			return
		}

		if checkRuns != nil {
			for _, run := range checkRuns.CheckRuns {
				if run.Status != nil && (*run.Status == "queued" || *run.Status == "in_progress") {
					logger.Info("%s: PR %s has pending check run: %s (%s). Waiting.", w.Name(), prUrl, run.GetName(), *run.Status)
					return
				}
			}
		}

		// If pending, ensure we only proceed if there is an actual failure
		if *combinedStatus.State == "pending" {
			hasFailure := false
			if checkRuns != nil {
				for _, run := range checkRuns.CheckRuns {
					if run.Conclusion != nil && *run.Conclusion == "failure" {
						hasFailure = true
						break
					}
				}
			}
			if !hasFailure {
				// No individual failure found, so it's genuinely pending.
				return
			}
			logger.Info("%s: PR %s is pending but has failed check runs. Treating as failure.", w.Name(), prUrl)
		}

		// Check if rebase/update is needed
		fullPR, _, err := w.githubClient.GetPullRequest(ctx, owner, repo, number)
		if err != nil {
			logger.Error("%s: Failed to get full PR details for %s: %v", w.Name(), prUrl, err)
		} else {
			if fullPR.MergeableState != nil && *fullPR.MergeableState == "behind" {
				logger.Info("%s: PR %s is behind base. Attempting to update branch...", w.Name(), prUrl)
				if err := w.githubClient.UpdateBranch(ctx, owner, repo, number); err != nil {
					logger.Error("%s: Failed to update branch for %s: %v", w.Name(), prUrl, err)
				} else {
					logger.Info("%s: Successfully triggered branch update for %s", w.Name(), prUrl)
					// Return here because update triggers new checks
					return
				}
			}
		}

		// Check last comment
		comments, err := w.githubClient.ListComments(ctx, owner, repo, number)
		if err != nil {
			logger.Error("%s: Failed to list comments for %s: %v", w.Name(), prUrl, err)
			return
		}

		shouldComment := true
		if len(comments) > 0 {
			lastComment := comments[len(comments)-1]
			if lastComment.User != nil && lastComment.User.Login != nil && strings.Contains(*lastComment.User.Login, "google-labs-jules") {
				if lastComment.Body != nil && strings.Contains(*lastComment.Body, failureCommentPrefix) {
					shouldComment = false
					logger.Info("%s: PR %s already has failure comment as last comment. Skipping.", w.Name(), prUrl)
				}
			}
		}

		if shouldComment {
			var failingCheckNames []string
			if checkRuns != nil {
				for _, run := range checkRuns.CheckRuns {
					if run.Conclusion != nil && *run.Conclusion == "failure" {
						failingCheckNames = append(failingCheckNames, run.GetName())
					}
				}
			}

			// Also check combined status for legacy status checks if any
			for _, status := range combinedStatus.Statuses {
				if status.State != nil && *status.State == "failure" {
					failingCheckNames = append(failingCheckNames, status.GetContext())
				}
			}

			msg := failureCommentPrefix
			for _, name := range failingCheckNames {
				msg += "\n- " + name
			}

			if err := w.githubClient.CreateComment(ctx, owner, repo, number, msg); err != nil {
				logger.Error("%s: Failed to create comment on %s: %v", w.Name(), prUrl, err)
			} else {
				logger.Info("%s: Posted failure comment on %s", w.Name(), prUrl)
			}
		}
	}
}
