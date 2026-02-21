package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/ratelimit"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

// MockRoundTripper for mocking HTTP responses
type MockRoundTripper struct {
	RoundTripFunc func(req *http.Request) *http.Response
}

func (m *MockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return m.RoundTripFunc(req), nil
}

func TestCreateSession_InvalidRemoteID(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Mock HTTP Client to return a session with an invalid ID
	mockClient := &http.Client{
		Transport: &MockRoundTripper{
			RoundTripFunc: func(req *http.Request) *http.Response {
				// Return success with invalid ID
				respBody := map[string]string{
					"name":       "sessions/invalid/id/with/slashes",
					"id":         "invalid/id/with/slashes",
					"createTime": time.Now().Format(time.RFC3339),
					"state":      "QUEUED",
					"title":      "Remote Session",
				}
				bodyBytes, _ := json.Marshal(respBody)
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(bytes.NewBuffer(bodyBytes)),
					Header:     make(http.Header),
				}
			},
		},
	}

	svc := &SessionServer{
		DB:         db,
		HTTPClient: mockClient,
		BaseURL:    "https://mock.api",
		Limiter:    ratelimit.New(1 * time.Nanosecond),
	}

	// Set API key to trigger remote path
	t.Setenv("JULES_API_KEY", "dummy-key")

	ctx := context.Background()
	req := &pb.CreateSessionRequest{
		Name:   "Test Session",
		Prompt: "Test Prompt",
	}

	// The session should be created with a valid local UUID, ignoring the invalid remote ID
	sess, err := svc.CreateSession(ctx, req)
	assert.NoError(t, err)
	assert.NotEqual(t, "invalid/id/with/slashes", sess.Id)
	assert.True(t, isValidSessionID(sess.Id), "Session ID should be valid UUID")
	assert.Len(t, sess.Id, 36, "Session ID should be UUID length")

	// Verify it's in the DB with the new ID
	var id string
	err = db.QueryRow("SELECT id FROM sessions WHERE id = ?", sess.Id).Scan(&id)
	assert.NoError(t, err)
	assert.Equal(t, sess.Id, id)
}
