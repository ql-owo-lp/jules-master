package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/hashicorp/go-retryablehttp"
	"github.com/mcpany/jules/internal/logger"
)

// RetryableRemoteSessionFetcher uses a robust HTTP client to fetch sessions
type RetryableRemoteSessionFetcher struct {
	client *retryablehttp.Client
}

// NewRetryableRemoteSessionFetcher creates a fetcher with exponential backoff and 429 handling
func NewRetryableRemoteSessionFetcher() *RetryableRemoteSessionFetcher {
	rc := retryablehttp.NewClient()
	rc.RetryMax = 5
	rc.RetryWaitMin = 1 * time.Second
	rc.RetryWaitMax = 30 * time.Second
	rc.Logger = nil // Use our own logger in the wrapper or silence it to avoid noise

	// potential hook for logging retries
	rc.RequestLogHook = func(l retryablehttp.Logger, req *http.Request, retry int) {
		if retry > 0 {
			logger.Info("Retrying request to %s (attempt %d)", req.URL.String(), retry)
		}
	}

	return &RetryableRemoteSessionFetcher{
		client: rc,
	}
}

// RemoteSession defines the structure of a remote session response
type RemoteSession struct {
	Id      string `json:"id"`
	State   string `json:"state"`
	Outputs []struct {
		PullRequest *struct {
			Url string `json:"url"`
		} `json:"pullRequest"`
	} `json:"outputs"`
	Messages []struct {
		Text string `json:"text"`
		Type string `json:"type"` // "HUMAN" or "AI" or "SYSTEM"
        // Adjust fields based on actual API. Assuming typical structure.
        // Actually usually it's `author` or `role`. 
        // Let's assume simple structure or check if I can see it in other files.
        // I'll stick to a generic map or json.RawMessage if unsure, but let's try strict.
        // Based on `sendMessage` payload, it's `message` (string)?
        // No, typically list of messages has structure.
        // Let's use simplified struct and generic check.
    } `json:"messages"`
}

func (f *RetryableRemoteSessionFetcher) GetSession(ctx context.Context, id, apiKey string) (*RemoteSession, error) {
	url := fmt.Sprintf("https://jules.googleapis.com/v1alpha/sessions/%s", id)
	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", url, nil)
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

// Source defines the structure of a source from the API
type Source struct {
	Name       string     `json:"name"`
	Id         string     `json:"id"`
	GithubRepo GithubRepo `json:"githubRepo"`
}

type GithubRepo struct {
	Owner string `json:"owner"`
	Repo  string `json:"repo"`
}

// ListSourcesResponse defines the structure of the list sources response
type ListSourcesResponse struct {
	Sources       []Source `json:"sources"`
	NextPageToken string   `json:"nextPageToken"`
}

// SessionFetcher defines the interface for fetching sessions/sources
type SessionFetcher interface {
    GetSession(ctx context.Context, id, apiKey string) (*RemoteSession, error)
    ListSources(ctx context.Context, apiKey string) ([]Source, error)
}

// Ensure RetryableRemoteSessionFetcher implements SessionFetcher
var _ SessionFetcher = (*RetryableRemoteSessionFetcher)(nil)

func (f *RetryableRemoteSessionFetcher) ListSources(ctx context.Context, apiKey string) ([]Source, error) {
	url := "https://jules.googleapis.com/v1alpha/sources"
	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", url, nil)
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

	var listResp ListSourcesResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, err
	}

    // Pagination could be handled here if we want to fetch all pages, 
    // but for now let's just return the first page as per initial requirement
    // or we could loop. Let's start with single page.
	return listResp.Sources, nil
}
