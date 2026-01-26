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

type PromptServer struct {
	pb.UnimplementedPromptServiceServer
	DB *sql.DB
}

// Predefined Prompts
func (s *PromptServer) ListPredefinedPrompts(ctx context.Context, _ *emptypb.Empty) (*pb.ListPredefinedPromptsResponse, error) {
	rows, err := s.DB.Query("SELECT id, title, prompt, profile_id FROM predefined_prompts")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prompts []*pb.PredefinedPrompt
	for rows.Next() {
		var p pb.PredefinedPrompt
		if err := rows.Scan(&p.Id, &p.Title, &p.Prompt, &p.ProfileId); err != nil {
			return nil, err
		}
		prompts = append(prompts, &p)
	}
	return &pb.ListPredefinedPromptsResponse{Prompts: prompts}, nil
}

func (s *PromptServer) GetPredefinedPrompt(ctx context.Context, req *pb.GetPromptRequest) (*pb.PredefinedPrompt, error) {
	var p pb.PredefinedPrompt
	err := s.DB.QueryRow("SELECT id, title, prompt, profile_id FROM predefined_prompts WHERE id = ?", req.Id).Scan(&p.Id, &p.Title, &p.Prompt, &p.ProfileId)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PromptServer) CreatePredefinedPrompt(ctx context.Context, req *pb.CreatePromptRequest) (*pb.PredefinedPrompt, error) {
	if len(req.Title) > 255 {
		return nil, fmt.Errorf("title is too long (max 255 characters)")
	}
	if len(req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}
	_, err := s.DB.Exec("INSERT INTO predefined_prompts (id, title, prompt, profile_id) VALUES (?, ?, ?, ?)", req.Id, req.Title, req.Prompt, req.ProfileId)
	if err != nil {
		return nil, err
	}
	return &pb.PredefinedPrompt{Id: req.Id, Title: req.Title, Prompt: req.Prompt, ProfileId: req.ProfileId}, nil
}

func (s *PromptServer) CreateManyPredefinedPrompts(ctx context.Context, req *pb.CreateManyPromptsRequest) (*emptypb.Empty, error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("INSERT INTO predefined_prompts (id, title, prompt, profile_id) VALUES (?, ?, ?, ?)")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for _, p := range req.Prompts {
		if len(p.Title) > 255 {
			return nil, fmt.Errorf("title is too long (max 255 characters)")
		}
		if len(p.Prompt) > 50000 {
			return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
		}
		if _, err := stmt.Exec(p.Id, p.Title, p.Prompt, p.ProfileId); err != nil {
			return nil, err
		}
	}
	return &emptypb.Empty{}, tx.Commit()
}

func (s *PromptServer) UpdatePredefinedPrompt(ctx context.Context, req *pb.UpdatePromptRequest) (*emptypb.Empty, error) {
	if req.Title != nil && len(*req.Title) > 255 {
		return nil, fmt.Errorf("title is too long (max 255 characters)")
	}
	if req.Prompt != nil && len(*req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}
	_, err := s.DB.Exec("UPDATE predefined_prompts SET title = ?, prompt = ? WHERE id = ?", req.Title, req.Prompt, req.Id)
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *PromptServer) DeletePredefinedPrompt(ctx context.Context, req *pb.DeletePromptRequest) (*emptypb.Empty, error) {
	_, err := s.DB.Exec("DELETE FROM predefined_prompts WHERE id = ?", req.Id)
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

// Quick Replies (Almost identical to Predefined Prompts, different table)
func (s *PromptServer) ListQuickReplies(ctx context.Context, _ *emptypb.Empty) (*pb.ListPredefinedPromptsResponse, error) {
	rows, err := s.DB.Query("SELECT id, title, prompt, profile_id FROM quick_replies")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prompts []*pb.PredefinedPrompt
	for rows.Next() {
		var p pb.PredefinedPrompt
		if err := rows.Scan(&p.Id, &p.Title, &p.Prompt, &p.ProfileId); err != nil {
			return nil, err
		}
		prompts = append(prompts, &p)
	}
	return &pb.ListPredefinedPromptsResponse{Prompts: prompts}, nil
}

func (s *PromptServer) GetQuickReply(ctx context.Context, req *pb.GetPromptRequest) (*pb.PredefinedPrompt, error) {
	var p pb.PredefinedPrompt
	err := s.DB.QueryRow("SELECT id, title, prompt, profile_id FROM quick_replies WHERE id = ?", req.Id).Scan(&p.Id, &p.Title, &p.Prompt, &p.ProfileId)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PromptServer) CreateQuickReply(ctx context.Context, req *pb.CreatePromptRequest) (*pb.PredefinedPrompt, error) {
	if len(req.Title) > 255 {
		return nil, fmt.Errorf("title is too long (max 255 characters)")
	}
	if len(req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}
	_, err := s.DB.Exec("INSERT INTO quick_replies (id, title, prompt, profile_id) VALUES (?, ?, ?, ?)", req.Id, req.Title, req.Prompt, req.ProfileId)
	if err != nil {
		return nil, err
	}
	return &pb.PredefinedPrompt{Id: req.Id, Title: req.Title, Prompt: req.Prompt, ProfileId: req.ProfileId}, nil
}

func (s *PromptServer) CreateManyQuickReplies(ctx context.Context, req *pb.CreateManyPromptsRequest) (*emptypb.Empty, error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("INSERT INTO quick_replies (id, title, prompt, profile_id) VALUES (?, ?, ?, ?)")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for _, p := range req.Prompts {
		if len(p.Title) > 255 {
			return nil, fmt.Errorf("title is too long (max 255 characters)")
		}
		if len(p.Prompt) > 50000 {
			return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
		}
		if _, err := stmt.Exec(p.Id, p.Title, p.Prompt, p.ProfileId); err != nil {
			return nil, err
		}
	}
	return &emptypb.Empty{}, tx.Commit()
}

func (s *PromptServer) UpdateQuickReply(ctx context.Context, req *pb.UpdatePromptRequest) (*emptypb.Empty, error) {
	if req.Title != nil && len(*req.Title) > 255 {
		return nil, fmt.Errorf("title is too long (max 255 characters)")
	}
	if req.Prompt != nil && len(*req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}
	_, err := s.DB.Exec("UPDATE quick_replies SET title = ?, prompt = ? WHERE id = ?", req.Title, req.Prompt, req.Id)
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *PromptServer) DeleteQuickReply(ctx context.Context, req *pb.DeletePromptRequest) (*emptypb.Empty, error) {
	_, err := s.DB.Exec("DELETE FROM quick_replies WHERE id = ?", req.Id)
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

// Global Prompt
func (s *PromptServer) GetGlobalPrompt(ctx context.Context, _ *emptypb.Empty) (*pb.GlobalPrompt, error) {
	var p pb.GlobalPrompt
	err := s.DB.QueryRow("SELECT prompt FROM global_prompt LIMIT 1").Scan(&p.Prompt)
	if err == sql.ErrNoRows {
		return &pb.GlobalPrompt{Prompt: ""}, nil
	} else if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PromptServer) SaveGlobalPrompt(ctx context.Context, req *pb.SaveGlobalPromptRequest) (*emptypb.Empty, error) {
	if len(req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}
	// Check if exists
	var id int
	err := s.DB.QueryRow("SELECT id FROM global_prompt LIMIT 1").Scan(&id)
	if err == sql.ErrNoRows {
		_, err = s.DB.Exec("INSERT INTO global_prompt (id, prompt) VALUES (1, ?)", req.Prompt)
	} else if err == nil {
		_, err = s.DB.Exec("UPDATE global_prompt SET prompt = ? WHERE id = ?", req.Prompt, id)
	}
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

// History Prompts
func (s *PromptServer) ListHistoryPrompts(ctx context.Context, _ *emptypb.Empty) (*pb.ListHistoryPromptsResponse, error) {
	rows, err := s.DB.Query("SELECT id, prompt, last_used_at, profile_id FROM history_prompts ORDER BY last_used_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prompts []*pb.HistoryPrompt
	for rows.Next() {
		var p pb.HistoryPrompt
		if err := rows.Scan(&p.Id, &p.Prompt, &p.LastUsedAt, &p.ProfileId); err != nil {
			return nil, err
		}
		prompts = append(prompts, &p)
	}
	return &pb.ListHistoryPromptsResponse{Prompts: prompts}, nil
}

func (s *PromptServer) GetRecentHistoryPrompts(ctx context.Context, req *pb.GetRecentRequest) (*pb.ListHistoryPromptsResponse, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	rows, err := s.DB.Query("SELECT id, prompt, last_used_at, profile_id FROM history_prompts ORDER BY last_used_at DESC LIMIT ?", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prompts []*pb.HistoryPrompt
	for rows.Next() {
		var p pb.HistoryPrompt
		if err := rows.Scan(&p.Id, &p.Prompt, &p.LastUsedAt, &p.ProfileId); err != nil {
			return nil, err
		}
		prompts = append(prompts, &p)
	}
	return &pb.ListHistoryPromptsResponse{Prompts: prompts}, nil
}

func (s *PromptServer) SaveHistoryPrompt(ctx context.Context, req *pb.SaveHistoryPromptRequest) (*emptypb.Empty, error) {
	if len(req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}

	// Check duplication (Node logic: don't save duplicate)
	// Actually Node logic: does it check? tests say "should not save duplicate".
	// Let's implement de-dupe.

	// Check if same prompt exists (recently? or ever?)
	// Node.js implementation:
	// const existing = await db.select().from(historyPrompts).where(eq(historyPrompts.prompt, prompt)).limit(1);
	// if (existing.length > 0) return; // simple logic

	var exists int
	err := s.DB.QueryRow("SELECT 1 FROM history_prompts WHERE prompt = ? LIMIT 1", req.Prompt).Scan(&exists)
	if err == nil {
		// Exists, update last_used_at? Or do nothing?
		// Node test: "should not save duplicate" -> implies count doesn't increase.
		return &emptypb.Empty{}, nil
	}

	// Insert
	// Need ID
	// Need timestamp
	id := uuid.New().String()

	_, err = s.DB.Exec("INSERT INTO history_prompts (id, prompt, last_used_at, profile_id) VALUES (?, ?, ?, 'default')", id, req.Prompt, time.Now().Format(time.RFC3339))
	if err != nil {
		return nil, err
	}

	return &emptypb.Empty{}, nil
}

// Repo Prompt
func (s *PromptServer) GetRepoPrompt(ctx context.Context, req *pb.GetRepoPromptRequest) (*pb.RepoPrompt, error) {
	var p pb.RepoPrompt
	err := s.DB.QueryRow("SELECT repo, prompt, profile_id FROM repo_prompts WHERE repo = ?", req.Repo).Scan(&p.Repo, &p.Prompt, &p.ProfileId)
	if err == sql.ErrNoRows {
		return &pb.RepoPrompt{Repo: req.Repo, Prompt: ""}, nil
	} else if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PromptServer) SaveRepoPrompt(ctx context.Context, req *pb.SaveRepoPromptRequest) (*emptypb.Empty, error) {
	if len(req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}
	// Upsert
	var exists int
	err := s.DB.QueryRow("SELECT 1 FROM repo_prompts WHERE repo = ? LIMIT 1", req.Repo).Scan(&exists)
	if err == nil {
		_, err = s.DB.Exec("UPDATE repo_prompts SET prompt = ? WHERE repo = ?", req.Prompt, req.Repo)
	} else {
		_, err = s.DB.Exec("INSERT INTO repo_prompts (repo, prompt, profile_id) VALUES (?, ?, 'default')", req.Repo, req.Prompt)
	}
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}
