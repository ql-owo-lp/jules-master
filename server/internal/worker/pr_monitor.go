package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync" // Added sync
	"time"

	"github.com/gammazero/workerpool"
	"github.com/google/go-github/v69/github"
	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
	"github.com/mcpany/jules/internal/service"
)

type GitHubClient interface {
	GetCombinedStatus(ctx context.Context, owner, repo, ref string) (*github.CombinedStatus, error)
	ListPullRequests(ctx context.Context, owner, repo string, opts *github.PullRequestListOptions) ([]*github.PullRequest, error)
	GetPullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, *github.Response, error)
	ListCheckRunsForRef(ctx context.Context, owner, repo, ref string, opts *github.ListCheckRunsOptions) (*github.ListCheckRunsResults, *github.Response, error)
	ListComments(ctx context.Context, owner, repo string, number int) ([]*github.IssueComment, error)
	CreateComment(ctx context.Context, owner, repo string, number int, body string) error
	GetUser(ctx context.Context, username string) (*github.User, error)
	ClosePullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error)
}

type RemoteSession struct {
	Id      string `json:"id"`
	State   string `json:"state"`
	Outputs []struct {
		PullRequest *struct {
			Url string `json:"url"`
		} `json:"pullRequest"`
	} `json:"outputs"`
}

type RemoteSessionFetcher interface {
	GetSession(ctx context.Context, id, apiKey string) (*RemoteSession, error)
}

type PRMonitorWorker struct {
	BaseWorker
	db              *sql.DB
	settingsService *service.SettingsServer
	sessionService  *service.SessionServer // Keep for local usage if needed
	githubClient    GitHubClient
	remoteFetcher   RemoteSessionFetcher
	apiKey          string
	pool            *workerpool.WorkerPool
}

func NewPRMonitorWorker(database *sql.DB, settingsService *service.SettingsServer, sessionService *service.SessionServer, gh GitHubClient, fetcher RemoteSessionFetcher, apiKey string) *PRMonitorWorker {
	return &PRMonitorWorker{
		BaseWorker: BaseWorker{
			NameStr:  "PRMonitorWorker",
			Interval: 60 * time.Second,
		},
		db:              database,
		settingsService: settingsService,
		sessionService:  sessionService,
		githubClient:    gh,
		remoteFetcher:   fetcher,
		apiKey:          apiKey,
		pool:            GetPoolFactory().NewPool(5), // Concurrency limit of 5
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
			if err := w.runCheck(ctx); err != nil {
				logger.Error("%s check failed: %s", w.Name(), err.Error())
			}
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
    return 60 * time.Second
}

func (w *PRMonitorWorker) runCheck(ctx context.Context) error {
	s, err := w.settingsService.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		return err
	}

	if !s.CheckFailingActionsEnabled {
		return nil
	}

	// List recent sessions (last 3 days)
	rows, err := w.db.QueryContext(ctx, "SELECT id FROM sessions WHERE last_interaction_at > ?", time.Now().Add(-72*time.Hour).UnixMilli())
	if err != nil {
		return err
	}
	defer rows.Close()

	var wg sync.WaitGroup

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		
		wg.Add(1)
		w.pool.Submit(func() {
			defer wg.Done()
			w.checkSession(ctx, id)
		})
	}
	
	wg.Wait()
	return nil
}

func (w *PRMonitorWorker) checkSession(ctx context.Context, id string) {
	// Fetch remote session for outputs
	sess, err := w.remoteFetcher.GetSession(ctx, id, w.apiKey)
	if err != nil {
		logger.Error("%s: Failed to fetch remote session %s: %v", w.Name(), id, err)
		return
	}

	if sess == nil || len(sess.Outputs) == 0 {
		return
	}

	// Find PR URL
	var prUrl string
	for _, output := range sess.Outputs {
		if output.PullRequest != nil && output.PullRequest.Url != "" {
			prUrl = output.PullRequest.Url
			break
		}
	}

	if prUrl == "" {
		return
	}

	// Parse PR URL
	owner, repo, number := parsePrUrl(prUrl)
	if owner == "" || repo == "" || number == 0 {
		return
	}

	// Get PR to get Head SHA
	pr, _, err := w.githubClient.GetPullRequest(ctx, owner, repo, number)
	if err != nil {
		logger.Error("%s: Failed to get PR %s: %v", w.Name(), prUrl, err)
		return
	}

	if pr.Head == nil || pr.Head.SHA == nil {
		return
	}

	// Check if PR has changes
	if pr.ChangedFiles != nil && *pr.ChangedFiles == 0 {
		logger.Info("%s: PR %s has 0 changed files. Closing.", w.Name(), prUrl)
		if _, err := w.githubClient.ClosePullRequest(ctx, owner, repo, number); err != nil {
			logger.Error("%s: Failed to close PR %s: %v", w.Name(), prUrl, err)
		}
		return
	}

	// Check Status
	combinedStatus, err := w.githubClient.GetCombinedStatus(ctx, owner, repo, *pr.Head.SHA)
	if err != nil {
		logger.Error("%s: Failed to get status for %s: %v", w.Name(), prUrl, err)
		return
	}
    
    if combinedStatus.State != nil && *combinedStatus.State == "failure" {
        // Check if ANY check run is pending/in_progress.
        // Even if one failed, we don't want to comment if others are still running.
        checkRuns, _, err := w.githubClient.ListCheckRunsForRef(ctx, owner, repo, *pr.Head.SHA, nil)
        if err != nil {
            logger.Error("%s: Failed to list check runs for %s: %v", w.Name(), prUrl, err)
            return
        }
        
        anyPending := false
        if checkRuns != nil {
            for _, run := range checkRuns.CheckRuns {
                if run.Status != nil && (*run.Status == "queued" || *run.Status == "in_progress") {
                    anyPending = true
                    break
                }
            }
        }
        
        if anyPending {
            // Skip commenting if checks are still running
            return
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
            if lastComment.Body != nil && strings.Contains(*lastComment.Body, "Checks failed") {
                // Check if user is us? ideally yes but looking at body is robust enough for now if message is unique
                // Or check user login if we know our bot name.
                // For now, simple text check.
                shouldComment = false
            }
        }
        
        if shouldComment {
            msg := "Checks failed. Please review the failures."
            if err := w.githubClient.CreateComment(ctx, owner, repo, number, msg); err != nil {
                 logger.Error("%s: Failed to create comment on %s: %v", w.Name(), prUrl, err)
            } else {
                logger.Info("%s: Posted failure comment on %s", w.Name(), prUrl)
            }
        }
    }
}

func parsePrUrl(urlStr string) (string, string, int) {
	if !strings.HasPrefix(urlStr, "https://github.com/") {
		return "", "", 0
	}
	path := strings.TrimPrefix(urlStr, "https://github.com/")
	parts := strings.Split(path, "/")
	if len(parts) < 4 || parts[2] != "pull" {
		return "", "", 0
	}
	num, err := strconv.Atoi(parts[3])
	if err != nil {
		return "", "", 0
	}
	return parts[0], parts[1], num
}

type HttpRemoteSessionFetcher struct {
	client *http.Client
}

func NewHttpRemoteSessionFetcher() *HttpRemoteSessionFetcher {
	return &HttpRemoteSessionFetcher{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (f *HttpRemoteSessionFetcher) GetSession(ctx context.Context, id, apiKey string) (*RemoteSession, error) {
	url := fmt.Sprintf("https://jules.googleapis.com/v1/sessions/%s", id)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		req.Header.Set("X-Goog-Api-Key", apiKey)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var sess RemoteSession
	if err := json.NewDecoder(resp.Body).Decode(&sess); err != nil {
		return nil, err
	}
	return &sess, nil
}
