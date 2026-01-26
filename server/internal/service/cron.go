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

type CronJobServer struct {
	pb.UnimplementedCronJobServiceServer
	DB *sql.DB
}

func (s *CronJobServer) ListCronJobs(ctx context.Context, _ *emptypb.Empty) (*pb.ListCronJobsResponse, error) {
	rows, err := s.DB.Query(`
		SELECT id, name, schedule, prompt, repo, branch, enabled, auto_approval, 
		       automation_mode, require_plan_approval, session_count, profile_id, 
			   created_at, updated_at, last_run_at 
		FROM cron_jobs 
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list cron jobs: %w", err)
	}
	defer rows.Close()

	var jobs []*pb.CronJob
	for rows.Next() {
		var j pb.CronJob
		var updatedAt, lastRunAt sql.NullString
		var automationMode sql.NullString

		// Scan into local vars then convert to proto
		// assuming automation_mode is string enum in DB

		if err := rows.Scan(
			&j.Id, &j.Name, &j.Schedule, &j.Prompt, &j.Repo, &j.Branch, &j.Enabled, &j.AutoApproval,
			&automationMode, &j.RequirePlanApproval, &j.SessionCount, &j.ProfileId,
			&j.CreatedAt, &updatedAt, &lastRunAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan cron job: %w", err)
		}

		if updatedAt.Valid {
			j.UpdatedAt = updatedAt.String
		}
		if lastRunAt.Valid {
			j.LastRunAt = lastRunAt.String
		}

		if automationMode.Valid {
			if automationMode.String == "AUTO_CREATE_PR" {
				j.AutomationMode = pb.AutomationMode_AUTO_CREATE_PR
			} else {
				j.AutomationMode = pb.AutomationMode_AUTOMATION_MODE_UNSPECIFIED
			}
		}
		jobs = append(jobs, &j)
	}
	return &pb.ListCronJobsResponse{CronJobs: jobs}, nil
}

func (s *CronJobServer) CreateCronJob(ctx context.Context, req *pb.CreateCronJobRequest) (*pb.CronJob, error) {
	id := uuid.New().String()
	createdAt := time.Now().Format(time.RFC3339)

	// Default automation mode
	automationModeStr := "AUTOMATION_MODE_UNSPECIFIED"
	if req.AutomationMode == pb.AutomationMode_AUTO_CREATE_PR {
		automationModeStr = "AUTO_CREATE_PR"
	}

	_, err := s.DB.Exec(`
		INSERT INTO cron_jobs (
			id, name, schedule, prompt, repo, branch, auto_approval, 
			automation_mode, require_plan_approval, session_count, profile_id, 
			enabled, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Name, req.Schedule, req.Prompt, req.Repo, req.Branch, req.AutoApproval,
		automationModeStr, req.RequirePlanApproval, req.SessionCount, req.ProfileId,
		true, createdAt) // Enabled by default

	if err != nil {
		return nil, fmt.Errorf("failed to create cron job: %w", err)
	}

	return &pb.CronJob{
		Id:                  id,
		Name:                req.Name,
		Schedule:            req.Schedule,
		Prompt:              req.Prompt,
		Repo:                req.Repo,
		Branch:              req.Branch,
		AutoApproval:        req.AutoApproval,
		AutomationMode:      req.AutomationMode,
		RequirePlanApproval: req.RequirePlanApproval,
		SessionCount:        req.SessionCount,
		ProfileId:           req.ProfileId,
		Enabled:             true,
		CreatedAt:           createdAt,
	}, nil
}

func (s *CronJobServer) UpdateCronJob(ctx context.Context, req *pb.UpdateCronJobRequest) (*emptypb.Empty, error) {
	// Dynamic updates based on what is set in the request.
	// Since proto3 fields are always present (zero values), we used optional in proto definitions where possible or rely on client sending full object?
	// In our proto definition we used `optional` fields.

	// Construct query dynamically
	// Simple implementation: fetch existing, merge, update.
	// Or better: UPDATE ... SET ... where field is updated.
	// Given the `optional` keyword in proto3, generated Go struct has pointers for optional fields.

	query := "UPDATE cron_jobs SET updated_at = ?"
	args := []interface{}{time.Now().Format(time.RFC3339)}

	if req.Name != nil {
		query += ", name = ?"
		args = append(args, *req.Name)
	}
	if req.Schedule != nil {
		query += ", schedule = ?"
		args = append(args, *req.Schedule)
	}
	if req.Prompt != nil {
		query += ", prompt = ?"
		args = append(args, *req.Prompt)
	}
	if req.Repo != nil {
		query += ", repo = ?"
		args = append(args, *req.Repo)
	}
	if req.Branch != nil {
		query += ", branch = ?"
		args = append(args, *req.Branch)
	}
	if req.AutoApproval != nil {
		query += ", auto_approval = ?"
		args = append(args, *req.AutoApproval)
	}
	if req.AutomationMode != nil {
		modeStr := "AUTOMATION_MODE_UNSPECIFIED"
		if *req.AutomationMode == pb.AutomationMode_AUTO_CREATE_PR {
			modeStr = "AUTO_CREATE_PR"
		}
		query += ", automation_mode = ?"
		args = append(args, modeStr)
	}
	if req.RequirePlanApproval != nil {
		query += ", require_plan_approval = ?"
		args = append(args, *req.RequirePlanApproval)
	}
	if req.SessionCount != nil {
		query += ", session_count = ?"
		args = append(args, *req.SessionCount)
	}
	if req.Enabled != nil {
		query += ", enabled = ?"
		args = append(args, *req.Enabled)
	}

	query += " WHERE id = ?"
	args = append(args, req.Id)

	_, err := s.DB.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update cron job: %w", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *CronJobServer) DeleteCronJob(ctx context.Context, req *pb.DeleteCronJobRequest) (*emptypb.Empty, error) {
	_, err := s.DB.Exec("DELETE FROM cron_jobs WHERE id = ?", req.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to delete cron job: %w", err)
	}
	return &emptypb.Empty{}, nil
}

func (s *CronJobServer) ToggleCronJob(ctx context.Context, req *pb.ToggleCronJobRequest) (*emptypb.Empty, error) {
	_, err := s.DB.Exec("UPDATE cron_jobs SET enabled = ?, updated_at = ? WHERE id = ?", req.Enabled, time.Now().Format(time.RFC3339), req.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to toggle cron job: %w", err)
	}
	return &emptypb.Empty{}, nil
}

func (s *CronJobServer) ExecuteCronJob(ctx context.Context, req *pb.ExecuteCronJobRequest) (*emptypb.Empty, error) {
	// 1. Fetch Cron Job
	var j pb.CronJob
	var automationMode sql.NullString
	err := s.DB.QueryRow(`SELECT name, prompt, repo, branch, auto_approval, automation_mode, require_plan_approval, session_count, profile_id FROM cron_jobs WHERE id = ?`, req.Id).Scan(
		&j.Name, &j.Prompt, &j.Repo, &j.Branch, &j.AutoApproval, &automationMode, &j.RequirePlanApproval, &j.SessionCount, &j.ProfileId,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch cron job: %w", err)
	}

	// 2. Create Job
	jobId := uuid.New().String()
	createdAt := time.Now().Format(time.RFC3339)
	status := "PENDING"

	_, err = s.DB.Exec(`
		INSERT INTO jobs (
			id, name, created_at, repo, branch, auto_approval, 
			background, prompt, session_count, status, automation_mode, 
			require_plan_approval, cron_job_id, profile_id, session_ids
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, jobId, j.Name, createdAt, j.Repo, j.Branch, j.AutoApproval,
		true, j.Prompt, j.SessionCount, status, automationMode,
		j.RequirePlanApproval, req.Id, j.ProfileId, "[]")

	if err != nil {
		return nil, fmt.Errorf("failed to insert job: %w", err)
	}

	// 3. Update Last Run
	_, _ = s.DB.Exec("UPDATE cron_jobs SET last_run_at = ? WHERE id = ?", createdAt, req.Id)

	return &emptypb.Empty{}, nil
}
