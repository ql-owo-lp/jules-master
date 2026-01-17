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
