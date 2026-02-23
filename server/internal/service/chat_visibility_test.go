package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/ratelimit"
	pb "github.com/mcpany/jules/proto"
)

func TestChatVisibility(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	svc := &ChatServer{DB: db, Limiter: ratelimit.New(1 * time.Nanosecond)}
	ctx := context.Background()

	jobId := uuid.New().String()

	// 1. Send Public Message
	_, err := svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:      jobId,
		Content:    "Public Message",
		IsHuman:    true,
		SenderName: "User", // Match frontend behavior
	})
	if err != nil {
		t.Fatalf("Failed to send public message: %v", err)
	}

	// 2. Send Private Message (AgentA -> AgentB)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:      jobId,
		Content:    "Private Message",
		IsHuman:    false, // Agent
		SenderName: "AgentA",
		Recipient:  "AgentB",
		ApiKey:     "", // Mocking: server ignores key validation if we mock create config or bypass?
		// Wait, SendChatMessage checks API key if !IsHuman.
		// I need to create chat config first.
	})
	// To bypass API key check, I can use IsHuman=true but set SenderName="AgentA".
	// The server only enforces API key if IsHuman=false.
	// But in reality, agents use IsHuman=false.
	// Let's use IsHuman=true for simplicity of setup, pretending it's a "User pretending to be AgentA".
	// The visibility logic depends on recipient, not IsHuman.

	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:      jobId,
		Content:    "Private Message",
		IsHuman:    true,
		SenderName: "AgentA",
		Recipient:  "AgentB",
	})
	if err != nil {
		t.Fatalf("Failed to send private message: %v", err)
	}

	// 3. List Messages with Empty Viewer (Anonymous/Admin)
	// EXPECTATION: BEFORE FIX, it returns BOTH. AFTER FIX, it returns ONLY Public.
	// For this test, I will assert the DESIRED behavior (Secure).
	// So initially this test should FAIL.

	resp, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId:      jobId,
		ViewerName: "", // Empty
	})
	if err != nil {
		t.Fatalf("Failed to list messages: %v", err)
	}

	if len(resp.Messages) != 1 {
		t.Errorf("Expected 1 message (public only) for empty viewer, got %d", len(resp.Messages))
		for _, m := range resp.Messages {
			t.Logf("Message: %s -> %s: %s", m.SenderName, m.Recipient, m.Content)
		}
	} else {
		if resp.Messages[0].Content != "Public Message" {
			t.Errorf("Expected 'Public Message', got '%s'", resp.Messages[0].Content)
		}
	}

	// 4. List Messages with Viewer "AgentB" (Recipient)
	respB, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId:      jobId,
		ViewerName: "AgentB",
	})
	if err != nil {
		t.Fatalf("Failed to list messages for AgentB: %v", err)
	}

	if len(respB.Messages) != 2 {
		t.Errorf("Expected 2 messages (public + private) for AgentB, got %d", len(respB.Messages))
	}

	// 5. List Messages with Viewer "AgentC" (Unrelated)
	respC, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId:      jobId,
		ViewerName: "AgentC",
	})
	if err != nil {
		t.Fatalf("Failed to list messages for AgentC: %v", err)
	}

	if len(respC.Messages) != 1 {
		t.Errorf("Expected 1 message (public only) for AgentC, got %d", len(respC.Messages))
	}
}
