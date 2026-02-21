package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/ratelimit"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestChatService_RateLimit(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create a limiter with a slightly longer interval to ensure we can hit it reliably in test
	limiter := ratelimit.New(200 * time.Millisecond)
	svc := &ChatServer{DB: db, Limiter: limiter}
	ctx := context.Background()

	req := &pb.SendChatMessageRequest{
		JobId:   "job-1",
		Content: "Hello",
	}

	// Request 1: Should pass rate limit check.
	// We might fail on validation (job_id missing config or whatever) but NOT rate limit.
	// Actually, CreateChatConfig is not called, so it might fail on key check or something.
	// SendChatMessage checks rate limit FIRST.
	_, err := svc.SendChatMessage(ctx, req)
	// We expect error because job_id validation or something else, but NOT rate limit
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"), "First request should not be rate limited: %v", err)
	}

	// Request 2: Should fail immediately if sent within 200ms.
	_, err = svc.SendChatMessage(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rate limit exceeded", "Second request should be rate limited")

	// Wait > 200ms
	time.Sleep(250 * time.Millisecond)

	// Request 3: Should pass rate limit check again.
	_, err = svc.SendChatMessage(ctx, req)
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"), "Request after delay should not be rate limited: %v", err)
	}
}

func TestChatService_RateLimit_CreateConfig(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	limiter := ratelimit.New(200 * time.Millisecond)
	svc := &ChatServer{DB: db, Limiter: limiter}
	ctx := context.Background()

	req := &pb.CreateChatConfigRequest{
		JobId:     "job-2",
		AgentName: "Agent007",
	}

	// Request 1: Pass
	_, err := svc.CreateChatConfig(ctx, req)
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"))
	}

	// Request 2: Fail
	_, err = svc.CreateChatConfig(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rate limit exceeded")
}
