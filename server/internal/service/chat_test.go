package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/proto"
)

func TestChatService(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	svc := &ChatServer{DB: db}
	ctx := context.Background()

	jobId := uuid.New().String()
	agentName := "TestAgent"

	// 1. CreateChatConfig
	config, err := svc.CreateChatConfig(ctx, &pb.CreateChatConfigRequest{
		JobId:     jobId,
		AgentName: agentName,
	})
	if err != nil {
		t.Fatalf("CreateChatConfig failed: %v", err)
	}
	if config.ApiKey == "" {
		t.Fatal("ApiKey should not be empty")
	}

	// 2. GetChatConfig
	gotConfig, err := svc.GetChatConfig(ctx, &pb.GetChatConfigRequest{
		JobId:     jobId,
		AgentName: agentName,
	})
	if err != nil {
		t.Fatalf("GetChatConfig failed: %v", err)
	}
	if gotConfig.ApiKey != config.ApiKey {
		t.Errorf("Expected ApiKey %s, got %s", config.ApiKey, gotConfig.ApiKey)
	}

	// 3. SendChatMessage (Human)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:     jobId,
		Content:   "Hello from Human",
		IsHuman:   true,
		SenderName: "Human",
	})
	if err != nil {
		t.Fatalf("SendChatMessage (Human) failed: %v", err)
	}

	// 4. SendChatMessage (Agent)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:     jobId,
		Content:   "Hello from Agent",
		IsHuman:   false,
		ApiKey:    config.ApiKey,
		SenderName: agentName, // Service should verify this or use config's agent name
	})
	if err != nil {
		t.Fatalf("SendChatMessage (Agent) failed: %v", err)
	}

	// 5. SendChatMessage (Agent Invalid Key)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:     jobId,
		Content:   "Hacker",
		IsHuman:   false,
		ApiKey:    "invalid-key",
	})
	if err == nil {
		t.Fatal("SendChatMessage should fail with invalid key")
	}

	// 6. ListChatMessages
	resp, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId: jobId,
	})
	if err != nil {
		t.Fatalf("ListChatMessages failed: %v", err)
	}

	if len(resp.Messages) != 2 {
		t.Fatalf("Expected 2 messages, got %d", len(resp.Messages))
	}

	if resp.Messages[0].Content != "Hello from Human" {
		t.Errorf("First message should be from Human, got: %s", resp.Messages[0].Content)
	}
	if resp.Messages[1].Content != "Hello from Agent" {
		t.Errorf("Second message should be from Agent, got: %s", resp.Messages[1].Content)
	}

	// 7. ListChatMessages with Since
    // Provide a timestamp before the first message was created
    // Actually typically 'Since' is an ID or Timestamp. Our proto uses string Since (likely timestamp).
    // Let's test limit.
	respLimit, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId: jobId,
		Limit: 1,
	})
	if err != nil {
		t.Fatalf("ListChatMessages with limit failed: %v", err)
	}
	if len(respLimit.Messages) != 1 {
		t.Errorf("Expected 1 message with limit, got %d", len(respLimit.Messages))
	}
}
