package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/ratelimit"
	pb "github.com/mcpany/jules/proto"
)

func TestChatServiceSecurity(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	svc := &ChatServer{DB: db, Limiter: ratelimit.New(1 * time.Nanosecond)}
	ctx := context.Background()

	jobId := uuid.New().String()

	t.Run("Prevent huge message content", func(t *testing.T) {
		hugeContent := strings.Repeat("A", 10001) // 10001 chars (limit is 10000)
		_, err := svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
			JobId:      jobId,
			Content:    hugeContent,
			IsHuman:    true,
			SenderName: "Human",
		})

		if err == nil {
			t.Error("Expected error for huge content, got success")
		} else if !strings.Contains(err.Error(), "content too long") {
			t.Errorf("Expected 'content too long' error, got: %v", err)
		}
	})

	t.Run("Prevent huge sender name", func(t *testing.T) {
		hugeSender := strings.Repeat("B", 101) // 101 chars (limit is 100)
		_, err := svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
			JobId:      jobId,
			Content:    "Hello",
			IsHuman:    true,
			SenderName: hugeSender,
		})

		if err == nil {
			t.Error("Expected error for huge sender name, got success")
		} else if !strings.Contains(err.Error(), "sender_name too long") {
			t.Errorf("Expected 'sender_name too long' error, got: %v", err)
		}
	})

	t.Run("Prevent huge recipient name", func(t *testing.T) {
		hugeRecipient := strings.Repeat("C", 101)
		_, err := svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
			JobId:      jobId,
			Content:    "Hello",
			IsHuman:    true,
			SenderName: "Human",
			Recipient:  hugeRecipient,
		})

		if err == nil {
			t.Error("Expected error for huge recipient name, got success")
		} else if !strings.Contains(err.Error(), "recipient too long") {
			t.Errorf("Expected 'recipient too long' error, got: %v", err)
		}
	})

	t.Run("Prevent huge job_id", func(t *testing.T) {
		hugeJobId := strings.Repeat("D", 65) // 65 chars (limit is 64)
		_, err := svc.SendChatMessage(ctx, &pb.SendChatMessageRequest{
			JobId:      hugeJobId,
			Content:    "Hello",
			IsHuman:    true,
			SenderName: "Human",
		})

		if err == nil {
			t.Error("Expected error for huge job_id, got success")
		} else if !strings.Contains(err.Error(), "job_id too long") {
			t.Errorf("Expected 'job_id too long' error, got: %v", err)
		}
	})
}
