package service

import (
	"context"
	"database/sql"
	"fmt"

	pb "github.com/mcpany/jules/gen"
)

type SettingsServer struct {
	pb.UnimplementedSettingsServiceServer
	DB *sql.DB
}

func (s *SettingsServer) GetSettings(ctx context.Context, req *pb.GetSettingsRequest) (*pb.Settings, error) {
	profileId := req.ProfileId
	if profileId == "" {
		profileId = "default"
	}

	row := s.DB.QueryRow(`
		SELECT 
			id, idle_poll_interval, active_poll_interval, title_truncate_length, line_clamp, 
			session_items_per_page, jobs_per_page, default_session_count, pr_status_poll_interval, 
			theme, auto_approval_interval, auto_retry_enabled, auto_retry_message, 
			auto_continue_enabled, auto_continue_message, session_cache_in_progress_interval, 
			session_cache_completed_no_pr_interval, session_cache_pending_approval_interval, 
			session_cache_max_age_days, auto_delete_stale_branches, auto_delete_stale_branches_after_days, 
			check_failing_actions_enabled, check_failing_actions_interval, check_failing_actions_threshold, 
			auto_close_stale_conflicted_prs, stale_conflicted_prs_duration_days, history_prompts_count, 
			min_session_interaction_interval, retry_timeout, profile_id, auto_approval_enabled
		FROM settings 
		WHERE profile_id = ? 
		LIMIT 1
	`, profileId)

	var settings pb.Settings
	err := row.Scan(
		&settings.Id, &settings.IdlePollInterval, &settings.ActivePollInterval, &settings.TitleTruncateLength, &settings.LineClamp,
		&settings.SessionItemsPerPage, &settings.JobsPerPage, &settings.DefaultSessionCount, &settings.PrStatusPollInterval,
		&settings.Theme, &settings.AutoApprovalInterval, &settings.AutoRetryEnabled, &settings.AutoRetryMessage,
		&settings.AutoContinueEnabled, &settings.AutoContinueMessage, &settings.SessionCacheInProgressInterval,
		&settings.SessionCacheCompletedNoPrInterval, &settings.SessionCachePendingApprovalInterval,
		&settings.SessionCacheMaxAgeDays, &settings.AutoDeleteStaleBranches, &settings.AutoDeleteStaleBranchesAfterDays,
		&settings.CheckFailingActionsEnabled, &settings.CheckFailingActionsInterval, &settings.CheckFailingActionsThreshold,
		&settings.AutoCloseStaleConflictedPrs, &settings.StaleConflictedPrsDurationDays, &settings.HistoryPromptsCount,
		&settings.MinSessionInteractionInterval, &settings.RetryTimeout, &settings.ProfileId, &settings.AutoApprovalEnabled,
	)

	if err == sql.ErrNoRows {
		// Return default settings if not found (matching Node.js behavior)
		return &pb.Settings{
			IdlePollInterval:                 120,
			ActivePollInterval:               30,
			TitleTruncateLength:              50,
			LineClamp:                        1,
			SessionItemsPerPage:              10,
			JobsPerPage:                      5,
			DefaultSessionCount:              10,
			PrStatusPollInterval:             60,
			Theme:                            "system",
			AutoApprovalInterval:             60,
			AutoRetryEnabled:                 true,
			AutoRetryMessage:                 "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution",
			AutoContinueEnabled:              true,
			AutoContinueMessage:              "Sounds good. Now go ahead finish the work",
			SessionCacheInProgressInterval:   60,
			SessionCacheCompletedNoPrInterval: 1800,
			SessionCachePendingApprovalInterval: 300,
			SessionCacheMaxAgeDays:           3,
			AutoDeleteStaleBranches:          false,
			AutoDeleteStaleBranchesAfterDays: 3,
			CheckFailingActionsEnabled:       true,
			CheckFailingActionsInterval:      600,
			CheckFailingActionsThreshold:     10,
			AutoCloseStaleConflictedPrs:      false,
			StaleConflictedPrsDurationDays:   3,
			HistoryPromptsCount:              10,
			MinSessionInteractionInterval:    60,
			RetryTimeout:                     1200,
			ProfileId:                        profileId,
		}, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed to scan settings: %w", err)
	}

	return &settings, nil
}

func (s *SettingsServer) UpdateSettings(ctx context.Context, req *pb.UpdateSettingsRequest) (*pb.UpdateSettingsResponse, error) {
	newSettings := req.Settings
	if newSettings == nil {
		return nil, fmt.Errorf("settings are required")
	}

	profileId := newSettings.ProfileId
	if profileId == "" {
		profileId = "default"
		newSettings.ProfileId = "default"
	}

	// Check if exists
	var existingId int64
	err := s.DB.QueryRow("SELECT id FROM settings WHERE profile_id = ?", profileId).Scan(&existingId)
	
	if err == sql.ErrNoRows {
		// Insert
		_, err = s.DB.Exec(`
			INSERT INTO settings (
				idle_poll_interval, active_poll_interval, title_truncate_length, line_clamp, 
				session_items_per_page, jobs_per_page, default_session_count, pr_status_poll_interval, 
				theme, auto_approval_interval, auto_retry_enabled, auto_retry_message, 
				auto_continue_enabled, auto_continue_message, session_cache_in_progress_interval, 
				session_cache_completed_no_pr_interval, session_cache_pending_approval_interval, 
				session_cache_max_age_days, auto_delete_stale_branches, auto_delete_stale_branches_after_days, 
				check_failing_actions_enabled, check_failing_actions_interval, check_failing_actions_threshold, 
				auto_close_stale_conflicted_prs, stale_conflicted_prs_duration_days, history_prompts_count, 
				min_session_interaction_interval, retry_timeout, profile_id, auto_approval_enabled
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			newSettings.IdlePollInterval, newSettings.ActivePollInterval, newSettings.TitleTruncateLength, newSettings.LineClamp,
			newSettings.SessionItemsPerPage, newSettings.JobsPerPage, newSettings.DefaultSessionCount, newSettings.PrStatusPollInterval,
			newSettings.Theme, newSettings.AutoApprovalInterval, newSettings.AutoRetryEnabled, newSettings.AutoRetryMessage,
			newSettings.AutoContinueEnabled, newSettings.AutoContinueMessage, newSettings.SessionCacheInProgressInterval,
			newSettings.SessionCacheCompletedNoPrInterval, newSettings.SessionCachePendingApprovalInterval,
			newSettings.SessionCacheMaxAgeDays, newSettings.AutoDeleteStaleBranches, newSettings.AutoDeleteStaleBranchesAfterDays,
			newSettings.CheckFailingActionsEnabled, newSettings.CheckFailingActionsInterval, newSettings.CheckFailingActionsThreshold,
			newSettings.AutoCloseStaleConflictedPrs, newSettings.StaleConflictedPrsDurationDays, newSettings.HistoryPromptsCount,
			newSettings.MinSessionInteractionInterval, newSettings.RetryTimeout, newSettings.ProfileId, newSettings.AutoApprovalEnabled,
		)
	} else if err == nil {
		// Update
		_, err = s.DB.Exec(`
			UPDATE settings SET
				idle_poll_interval=?, active_poll_interval=?, title_truncate_length=?, line_clamp=?, 
				session_items_per_page=?, jobs_per_page=?, default_session_count=?, pr_status_poll_interval=?, 
				theme=?, auto_approval_interval=?, auto_retry_enabled=?, auto_retry_message=?, 
				auto_continue_enabled=?, auto_continue_message=?, session_cache_in_progress_interval=?, 
				session_cache_completed_no_pr_interval=?, session_cache_pending_approval_interval=?, 
				session_cache_max_age_days=?, auto_delete_stale_branches=?, auto_delete_stale_branches_after_days=?, 
				check_failing_actions_enabled=?, check_failing_actions_interval=?, check_failing_actions_threshold=?, 
				auto_close_stale_conflicted_prs=?, stale_conflicted_prs_duration_days=?, history_prompts_count=?, 
				min_session_interaction_interval=?, retry_timeout=?, auto_approval_enabled=?
			WHERE id = ?
		`,
			newSettings.IdlePollInterval, newSettings.ActivePollInterval, newSettings.TitleTruncateLength, newSettings.LineClamp,
			newSettings.SessionItemsPerPage, newSettings.JobsPerPage, newSettings.DefaultSessionCount, newSettings.PrStatusPollInterval,
			newSettings.Theme, newSettings.AutoApprovalInterval, newSettings.AutoRetryEnabled, newSettings.AutoRetryMessage,
			newSettings.AutoContinueEnabled, newSettings.AutoContinueMessage, newSettings.SessionCacheInProgressInterval,
			newSettings.SessionCacheCompletedNoPrInterval, newSettings.SessionCachePendingApprovalInterval,
			newSettings.SessionCacheMaxAgeDays, newSettings.AutoDeleteStaleBranches, newSettings.AutoDeleteStaleBranchesAfterDays,
			newSettings.CheckFailingActionsEnabled, newSettings.CheckFailingActionsInterval, newSettings.CheckFailingActionsThreshold,
			newSettings.AutoCloseStaleConflictedPrs, newSettings.StaleConflictedPrsDurationDays, newSettings.HistoryPromptsCount,
			newSettings.MinSessionInteractionInterval, newSettings.RetryTimeout, newSettings.AutoApprovalEnabled,
			existingId,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to save settings: %w", err)
	}

	return &pb.UpdateSettingsResponse{Success: true}, nil
}
