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
	agentName1 := "Agent1"
	agentName2 := "Agent2"

	// 1. CreateChatConfig (Agent 1)
	config1, err := svc.CreateChatConfig(ctx, &pb.CreateChatConfigRequest{
		JobId:     jobId,
		AgentName: agentName1,
	})
	if err != nil {
		t.Fatalf("CreateChatConfig Agent1 failed: %v", err)
	}

	// 2. CreateChatConfig (Agent 2) - Should succeed now with composite PK
	config2, err := svc.CreateChatConfig(ctx, &pb.CreateChatConfigRequest{
		JobId:     jobId,
		AgentName: agentName2,
	})
	if err != nil {
		t.Fatalf("CreateChatConfig Agent2 failed: %v", err)
	}

	// 3. Send Message (Public from Agent 1)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:      jobId,
		Content:    "Hello Everyone",
		IsHuman:    false,
		ApiKey:     config1.ApiKey,
		SenderName: agentName1,
	})
	if err != nil {
		t.Fatalf("SendChatMessage Public failed: %v", err)
	}

	// 4. Send Message (Private from Agent 1 to Agent 2)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:      jobId,
		Content:    "Secret for Agent2",
		IsHuman:    false,
		ApiKey:     config1.ApiKey,
		SenderName: agentName1,
		Recipient:  agentName2,
	})
	if err != nil {
		t.Fatalf("SendChatMessage Private failed: %v", err)
	}

	// 5. Send Message (Private from Agent 2 to Agent 1)
	_, err = svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
		JobId:      jobId,
		Content:    "Secret for Agent1",
		IsHuman:    false,
		ApiKey:     config2.ApiKey,
		SenderName: agentName2,
		Recipient:  agentName1,
	})
	if err != nil {
		t.Fatalf("SendChatMessage Private failed: %v", err)
	}

	// 6. List Messages as Agent 1 (Should see Public + From Me + To Me)
	// Expect: "Hello Everyone", "Secret for Agent2" (sent by me), "Secret for Agent1" (sent to me)
	resp1, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId:      jobId,
		ViewerName: agentName1,
	})
	if err != nil {
		t.Fatalf("ListChatMessages Agent1 failed: %v", err)
	}

	if len(resp1.Messages) != 3 {
		t.Errorf("Agent1 should see 3 messages, got %d", len(resp1.Messages))
		for _, m := range resp1.Messages {
			t.Logf(" - %s -> %s: %s", m.SenderName, m.Recipient, m.Content)
		}
	}

	// 7. List Messages as Agent 2 (Should see Public + From Me + To Me)
	// Expect: "Hello Everyone", "Secret for Agent2" (sent to me), "Secret for Agent1" (sent by me)
	resp2, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId:      jobId,
		ViewerName: agentName2,
	})
	if err != nil {
		t.Fatalf("ListChatMessages Agent2 failed: %v", err)
	}
	if len(resp2.Messages) != 3 {
		t.Errorf("Agent2 should see 3 messages, got %d", len(resp2.Messages))
	}

	// 8. List Messages as Human (ViewerName="Human", assumes Human sees all public + addressed to Human + sent by Human)
	// Actually, usually Human assumes Admin role in these debug views, but strictly following logic:
	// If ViewerName is "Human", checks recipient="Human" or sender="Human" or Public.
	// Private messages between Agent1 and Agent2 should NOT be visible strictly speaking if we follow the logic.
	// But let's verify if we send ViewerName="" (Admin/God mode?) -> logic says "no filter" if ViewerName empty.
	// Let's test "Admin" view (empty ViewerName)
	respAdmin, err := svc.ListChatMessages(ctx, &pb.ListChatMessagesRequest{
		JobId: jobId,
	})
	if err != nil {
		t.Fatalf("ListChatMessages Admin failed: %v", err)
	}
	if len(respAdmin.Messages) != 3 {
		t.Errorf("Admin should see 3 messages, got %d", len(respAdmin.Messages))
	}
}
