package service

import (
	"context"
	"testing"

	pb "github.com/mcpany/jules/gen"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestPromptService_PredefinedPrompts(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    svc := &PromptServer{DB: db}
    ctx := context.Background()
    
    // Create
    _, err := svc.CreatePredefinedPrompt(ctx, &pb.CreatePromptRequest{Id: "p1", Title: "Prompt 1", Prompt: "Content 1"})
    assert.NoError(t, err)
    
    // Get
    got, err := svc.GetPredefinedPrompt(ctx, &pb.GetPromptRequest{Id: "p1"})
    assert.NoError(t, err)
    assert.Equal(t, "Prompt 1", got.Title)
    
    // Create Many
    err = nil // reused
    _, err = svc.CreateManyPredefinedPrompts(ctx, &pb.CreateManyPromptsRequest{
        Prompts: []*pb.CreatePromptRequest{
            {Id: "p2", Title: "P2", Prompt: "C2"},
            {Id: "p3", Title: "P3", Prompt: "C3"},
        },
    })
    assert.NoError(t, err)
    
    // List
    list, err := svc.ListPredefinedPrompts(ctx, &emptypb.Empty{})
    assert.NoError(t, err)
    assert.Len(t, list.Prompts, 3)
    
    // Update
    newTitle := "New"
    newPrompt := "Content"
    _, err = svc.UpdatePredefinedPrompt(ctx, &pb.UpdatePromptRequest{Id: "p1", Title: &newTitle, Prompt: &newPrompt})
    assert.NoError(t, err)
    
    got, _ = svc.GetPredefinedPrompt(ctx, &pb.GetPromptRequest{Id: "p1"})
    assert.Equal(t, "New", got.Title)
    
    // Delete
    _, err = svc.DeletePredefinedPrompt(ctx, &pb.DeletePromptRequest{Id: "p1"})
    assert.NoError(t, err)
    
    list, _ = svc.ListPredefinedPrompts(ctx, &emptypb.Empty{})
    assert.Len(t, list.Prompts, 2)
}

func TestPromptService_GlobalPrompt(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    svc := &PromptServer{DB: db}
    ctx := context.Background()
    
    // Initial empty
    got, err := svc.GetGlobalPrompt(ctx, &emptypb.Empty{})
    assert.NoError(t, err)
    assert.Equal(t, "", got.Prompt)
    
    // Save
    _, err = svc.SaveGlobalPrompt(ctx, &pb.SaveGlobalPromptRequest{Prompt: "Global 1"})
    assert.NoError(t, err)
    
    got, _ = svc.GetGlobalPrompt(ctx, &emptypb.Empty{})
    assert.Equal(t, "Global 1", got.Prompt)
    
    // Update
    _, err = svc.SaveGlobalPrompt(ctx, &pb.SaveGlobalPromptRequest{Prompt: "Global 2"})
    assert.NoError(t, err)
    
    got, _ = svc.GetGlobalPrompt(ctx, &emptypb.Empty{})
    assert.Equal(t, "Global 2", got.Prompt)
}

func TestPromptService_HistoryPrompts(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    svc := &PromptServer{DB: db}
    ctx := context.Background()
    
    // Save
    _, err := svc.SaveHistoryPrompt(ctx, &pb.SaveHistoryPromptRequest{Prompt: "History 1"})
    assert.NoError(t, err)
    
    // List
    list, err := svc.ListHistoryPrompts(ctx, &emptypb.Empty{})
    assert.NoError(t, err)
    assert.Len(t, list.Prompts, 1)
    
    // Duplicate check
    _, err = svc.SaveHistoryPrompt(ctx, &pb.SaveHistoryPromptRequest{Prompt: "History 1"})
    assert.NoError(t, err)
    
    list, _ = svc.ListHistoryPrompts(ctx, &emptypb.Empty{})
    assert.Len(t, list.Prompts, 1)
}

func TestPromptService_RepoPrompts(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    svc := &PromptServer{DB: db}
    ctx := context.Background()
    
    // Save
    _, err := svc.SaveRepoPrompt(ctx, &pb.SaveRepoPromptRequest{Repo: "user/repo1", Prompt: "P1"})
    assert.NoError(t, err)
    
    // Get
    got, err := svc.GetRepoPrompt(ctx, &pb.GetRepoPromptRequest{Repo: "user/repo1"})
    assert.NoError(t, err)
    assert.Equal(t, "P1", got.Prompt)
    
    // Update
    _, err = svc.SaveRepoPrompt(ctx, &pb.SaveRepoPromptRequest{Repo: "user/repo1", Prompt: "P2"})
    assert.NoError(t, err)
    
    got, _ = svc.GetRepoPrompt(ctx, &pb.GetRepoPromptRequest{Repo: "user/repo1"})
    assert.Equal(t, "P2", got.Prompt)
}
