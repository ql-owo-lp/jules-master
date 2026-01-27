package service

import (
	"context"
	"database/sql"
	"fmt"

	pb "github.com/mcpany/jules/proto"
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

	query := `SELECT id, idle_poll_interval, active_poll_interval, title_truncate_length, line_clamp, session_items_per_page, jobs_per_page, default_session_count, pr_status_poll_interval, theme, auto_approval_interval, auto_retry_enabled, auto_retry_message, auto_continue_enabled, auto_continue_message, session_cache_in_progress_interval, session_cache_completed_no_pr_interval, session_cache_pending_approval_interval, session_cache_max_age_days, auto_delete_stale_branches, auto_delete_stale_branches_after_days, check_failing_actions_enabled, check_failing_actions_interval, check_failing_actions_threshold, auto_close_stale_conflicted_prs, stale_conflicted_prs_duration_days, history_prompts_count, min_session_interaction_interval, retry_timeout, profile_id, auto_approval_enabled, auto_approval_all_sessions, auto_continue_all_sessions FROM settings WHERE profile_id = ? LIMIT 1`

	var settings pb.Settings
	err := s.DB.QueryRow(query, profileId).Scan(
		&settings.Id, &settings.IdlePollInterval, &settings.ActivePollInterval, &settings.TitleTruncateLength, &settings.LineClamp,
		&settings.SessionItemsPerPage, &settings.JobsPerPage, &settings.DefaultSessionCount, &settings.PrStatusPollInterval,
		&settings.Theme, &settings.AutoApprovalInterval, &settings.AutoRetryEnabled, &settings.AutoRetryMessage,
		&settings.AutoContinueEnabled, &settings.AutoContinueMessage, &settings.SessionCacheInProgressInterval,
		&settings.SessionCacheCompletedNoPrInterval, &settings.SessionCachePendingApprovalInterval,
		&settings.SessionCacheMaxAgeDays, &settings.AutoDeleteStaleBranches, &settings.AutoDeleteStaleBranchesAfterDays,
		&settings.CheckFailingActionsEnabled, &settings.CheckFailingActionsInterval, &settings.CheckFailingActionsThreshold,
		&settings.AutoCloseStaleConflictedPrs, &settings.StaleConflictedPrsDurationDays, &settings.HistoryPromptsCount,
		&settings.MinSessionInteractionInterval, &settings.RetryTimeout, &settings.ProfileId, &settings.AutoApprovalEnabled,
		&settings.AutoApprovalAllSessions, &settings.AutoContinueAllSessions,
	)
	settings.MaxConcurrentBackgroundWorkers = 5

	if err == sql.ErrNoRows {
		return &pb.Settings{
			IdlePollInterval:                    120,
			ActivePollInterval:                  30,
			TitleTruncateLength:                 50,
			LineClamp:                           1,
			SessionItemsPerPage:                 10,
			JobsPerPage:                         5,
			DefaultSessionCount:                 10,
			PrStatusPollInterval:                60,
			Theme:                               "system",
			AutoApprovalInterval:                60,
			AutoRetryEnabled:                    true,
			AutoRetryMessage:                    "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution",
			AutoContinueEnabled:                 true,
			AutoContinueMessage:                 "Sounds good. Now go ahead finish the work",
			SessionCacheInProgressInterval:      60,
			SessionCacheCompletedNoPrInterval:   1800,
			SessionCachePendingApprovalInterval: 300,
			SessionCacheMaxAgeDays:              3,
			AutoDeleteStaleBranches:             false,
			AutoDeleteStaleBranchesAfterDays:    3,
			CheckFailingActionsEnabled:          true,
			CheckFailingActionsInterval:         600,
			CheckFailingActionsThreshold:        10,
			AutoCloseStaleConflictedPrs:         false,
			StaleConflictedPrsDurationDays:      3,
			HistoryPromptsCount:                 10,
			MinSessionInteractionInterval:       60,
			RetryTimeout:                        1200,
			ProfileId:                           profileId,
			MaxConcurrentBackgroundWorkers:      5,
			AutoApprovalAllSessions:             true,
			AutoContinueAllSessions:             true,
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

	var existingId int64
	err := s.DB.QueryRow("SELECT id FROM settings WHERE profile_id = ?", profileId).Scan(&existingId)

	if err == sql.ErrNoRows {
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
				min_session_interaction_interval, retry_timeout, profile_id, auto_approval_enabled,
				auto_approval_all_sessions, auto_continue_all_sessions
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			newSettings.GetIdlePollInterval(), newSettings.GetActivePollInterval(), newSettings.GetTitleTruncateLength(), newSettings.GetLineClamp(),
			newSettings.GetSessionItemsPerPage(), newSettings.GetJobsPerPage(), newSettings.GetDefaultSessionCount(), newSettings.GetPrStatusPollInterval(),
			newSettings.GetTheme(), newSettings.GetAutoApprovalInterval(), newSettings.GetAutoRetryEnabled(), newSettings.GetAutoRetryMessage(),
			newSettings.GetAutoContinueEnabled(), newSettings.GetAutoContinueMessage(), newSettings.GetSessionCacheInProgressInterval(),
			newSettings.GetSessionCacheCompletedNoPrInterval(), newSettings.GetSessionCachePendingApprovalInterval(),
			newSettings.GetSessionCacheMaxAgeDays(), newSettings.GetAutoDeleteStaleBranches(), newSettings.GetAutoDeleteStaleBranchesAfterDays(),
			newSettings.GetCheckFailingActionsEnabled(), newSettings.GetCheckFailingActionsInterval(), newSettings.GetCheckFailingActionsThreshold(),
			newSettings.GetAutoCloseStaleConflictedPrs(), newSettings.GetStaleConflictedPrsDurationDays(), newSettings.GetHistoryPromptsCount(),
			newSettings.GetMinSessionInteractionInterval(), newSettings.GetRetryTimeout(), newSettings.GetProfileId(), newSettings.GetAutoApprovalEnabled(),
			newSettings.GetAutoApprovalAllSessions(), newSettings.GetAutoContinueAllSessions(),
		)
	} else if err == nil {
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
				min_session_interaction_interval=?, retry_timeout=?, auto_approval_enabled=?,
				auto_approval_all_sessions=?, auto_continue_all_sessions=?
			WHERE id = ?
		`,
			newSettings.GetIdlePollInterval(), newSettings.GetActivePollInterval(), newSettings.GetTitleTruncateLength(), newSettings.GetLineClamp(),
			newSettings.GetSessionItemsPerPage(), newSettings.GetJobsPerPage(), newSettings.GetDefaultSessionCount(), newSettings.GetPrStatusPollInterval(),
			newSettings.GetTheme(), newSettings.GetAutoApprovalInterval(), newSettings.GetAutoRetryEnabled(), newSettings.GetAutoRetryMessage(),
			newSettings.GetAutoContinueEnabled(), newSettings.GetAutoContinueMessage(), newSettings.GetSessionCacheInProgressInterval(),
			newSettings.GetSessionCacheCompletedNoPrInterval(), newSettings.GetSessionCachePendingApprovalInterval(),
			newSettings.GetSessionCacheMaxAgeDays(), newSettings.GetAutoDeleteStaleBranches(), newSettings.GetAutoDeleteStaleBranchesAfterDays(),
			newSettings.GetCheckFailingActionsEnabled(), newSettings.GetCheckFailingActionsInterval(), newSettings.GetCheckFailingActionsThreshold(),
			newSettings.GetAutoCloseStaleConflictedPrs(), newSettings.GetStaleConflictedPrsDurationDays(), newSettings.GetHistoryPromptsCount(),
			newSettings.GetMinSessionInteractionInterval(), newSettings.GetRetryTimeout(), newSettings.GetAutoApprovalEnabled(),
			newSettings.GetAutoApprovalAllSessions(), newSettings.GetAutoContinueAllSessions(),
			existingId,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to save settings: %w", err)
	}

	return &pb.UpdateSettingsResponse{Success: true}, nil
}
