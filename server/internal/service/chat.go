package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/proto"
	"google.golang.org/protobuf/types/known/emptypb"
)

type ChatServer struct {
	pb.UnimplementedChatServiceServer
	DB *sql.DB
}

func (s *ChatServer) GetChatConfig(ctx context.Context, req *pb.GetChatConfigRequest) (*pb.ChatConfig, error) {
	if req.JobId == "" {
		return nil, fmt.Errorf("job_id is required")
	}
	if req.AgentName == "" {
		return nil, fmt.Errorf("agent_name is required")
	}

	var config pb.ChatConfig
	err := s.DB.QueryRow("SELECT job_id, agent_name, api_key, created_at FROM chat_configs WHERE job_id = ? AND agent_name = ?", req.JobId, req.AgentName).Scan(
		&config.JobId, &config.AgentName, &config.ApiKey, &config.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("chat config not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get chat config: %w", err)
	}

	return &config, nil
}

func (s *ChatServer) CreateChatConfig(ctx context.Context, req *pb.CreateChatConfigRequest) (*pb.ChatConfig, error) {
	if req.JobId == "" {
		return nil, fmt.Errorf("job_id is required")
	}
	if req.AgentName == "" {
		return nil, fmt.Errorf("agent_name is required")
	}

	// Check if already exists
	var exists string
	err := s.DB.QueryRow("SELECT job_id FROM chat_configs WHERE job_id = ? AND agent_name = ?", req.JobId, req.AgentName).Scan(&exists)
	if err == nil {
		return s.GetChatConfig(ctx, &pb.GetChatConfigRequest{JobId: req.JobId, AgentName: req.AgentName})
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check existing config: %w", err)
	}

	apiKey := uuid.New().String()
	createdAt := time.Now().Format(time.RFC3339)

	_, err = s.DB.Exec("INSERT INTO chat_configs (job_id, agent_name, api_key, created_at) VALUES (?, ?, ?, ?)",
		req.JobId, req.AgentName, apiKey, createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create chat config: %w", err)
	}

	return &pb.ChatConfig{
		JobId:     req.JobId,
		AgentName: req.AgentName,
		ApiKey:    apiKey,
		CreatedAt: createdAt,
	}, nil
}

func (s *ChatServer) SendChatMessage(ctx context.Context, req *pb.SendChatMessageRequest) (*emptypb.Empty, error) {
	if req.JobId == "" {
		return nil, fmt.Errorf("job_id is required")
	}
	if req.Content == "" {
		return nil, fmt.Errorf("content is required")
	}

	senderName := req.SenderName

	// Auth check
	if !req.IsHuman {
		if req.ApiKey == "" {
			return nil, fmt.Errorf("api_key is required for agents")
		}
		var validKey string
		var agentName string
		err := s.DB.QueryRow("SELECT api_key, agent_name FROM chat_configs WHERE job_id = ? AND api_key = ?", req.JobId, req.ApiKey).Scan(&validKey, &agentName)
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invalid api key")
		} else if err != nil {
			return nil, fmt.Errorf("failed to verify api key: %w", err)
		}
		// If valid, use the agent name associated with the key
		senderName = agentName
	} else {
		if senderName == "" {
			senderName = "Human"
		}
	}

	id := uuid.New().String()
	createdAt := time.Now().Format(time.RFC3339)

	_, err := s.DB.Exec("INSERT INTO chat_messages (id, job_id, sender_name, content, created_at, is_human) VALUES (?, ?, ?, ?, ?, ?)",
		id, req.JobId, senderName, req.Content, createdAt, req.IsHuman)
	if err != nil {
		return nil, fmt.Errorf("failed to save message: %w", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *ChatServer) ListChatMessages(ctx context.Context, req *pb.ListChatMessagesRequest) (*pb.ListChatMessagesResponse, error) {
	if req.JobId == "" {
		return nil, fmt.Errorf("job_id is required")
	}

	query := "SELECT id, job_id, sender_name, content, created_at, is_human FROM chat_messages WHERE job_id = ?"
	args := []interface{}{req.JobId}

	if req.Since != "" {
		query += " AND created_at > ?"
		args = append(args, req.Since)
	}

	query += " ORDER BY created_at ASC"

	if req.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, req.Limit)
	}

	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}
	defer rows.Close()

	var messages []*pb.ChatMessage
	for rows.Next() {
		var m pb.ChatMessage
		if err := rows.Scan(&m.Id, &m.JobId, &m.SenderName, &m.Content, &m.CreatedAt, &m.IsHuman); err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		messages = append(messages, &m)
	}

	return &pb.ListChatMessagesResponse{Messages: messages}, nil
}
