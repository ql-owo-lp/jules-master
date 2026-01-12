package service

import (
	"context"
	"database/sql"
	"fmt"

	"connectrpc.com/connect"
	"github.com/jules-org/jules/backend/pkg/db"
	"github.com/jules-org/jules/backend/pkg/proto/jules"
)

type SettingsService struct{}

func NewSettingsService() *SettingsService {
	return &SettingsService{}
}

func (s *SettingsService) GetSettings(ctx context.Context, req *connect.Request[jules.GetSettingsRequest]) (*connect.Response[jules.Settings], error) {
	profileID := req.Msg.ProfileId
	if profileID == "" {
		profileID = "default"
	}

	var dSettings db.Settings
	err := db.DB.GetContext(ctx, &dSettings, "SELECT * FROM settings WHERE profile_id = ?", profileID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return defaults or create them?
			// For now, return NotFound to match previous logic, or maybe we should upsert defaults?
			// The nodejs logic created defaults. Let's return error for now as init should have handled it.
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("settings not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&jules.Settings{
		Id:                                  int32(dSettings.ID),
		IdlePollInterval:                    int32(dSettings.IdlePollInterval),
		ActivePollInterval:                  int32(dSettings.ActivePollInterval),
		TitleTruncateLength:                 int32(dSettings.TitleTruncateLength),
		LineClamp:                           int32(dSettings.LineClamp),
		SessionItemsPerPage:                 int32(dSettings.SessionItemsPerPage),
		JobsPerPage:                         int32(dSettings.JobsPerPage),
		DefaultSessionCount:                 int32(dSettings.DefaultSessionCount),
		PrStatusPollInterval:                int32(dSettings.PrStatusPollInterval),
		Theme:                               dSettings.Theme,
		HistoryPromptsCount:                 int32(dSettings.HistoryPromptsCount),
		AutoApprovalEnabled:                 dSettings.AutoApprovalEnabled,
		AutoApprovalInterval:                int32(dSettings.AutoApprovalInterval),
		AutoRetryEnabled:                    dSettings.AutoRetryEnabled,
		AutoRetryMessage:                    dSettings.AutoRetryMessage,
		AutoContinueEnabled:                 dSettings.AutoContinueEnabled,
		AutoContinueMessage:                 dSettings.AutoContinueMessage,
		SessionCacheInProgressInterval:      int32(dSettings.SessionCacheInProgressInterval),
		SessionCacheCompletedNoPrInterval:   int32(dSettings.SessionCacheCompletedNoPRInterval),
		SessionCachePendingApprovalInterval: int32(dSettings.SessionCachePendingApprovalInterval),
		SessionCacheMaxAgeDays:              int32(dSettings.SessionCacheMaxAgeDays),
		AutoDeleteStaleBranches:             dSettings.AutoDeleteStaleBranches,
		AutoDeleteStaleBranchesAfterDays:    int32(dSettings.AutoDeleteStaleBranchesAfterDays),
		AutoDeleteStaleBranchesInterval:     int32(dSettings.AutoDeleteStaleBranchesInterval),
		CheckFailingActionsEnabled:          dSettings.CheckFailingActionsEnabled,
		CheckFailingActionsInterval:         int32(dSettings.CheckFailingActionsInterval),
		CheckFailingActionsThreshold:        int32(dSettings.CheckFailingActionsThreshold),
		ClosePrOnConflictEnabled:            dSettings.ClosePROnConflictEnabled,
		AutoCloseStaleConflictedPrs:         dSettings.AutoCloseStaleConflictedPRs,
		StaleConflictedPrsDurationDays:      int32(dSettings.StaleConflictedPRsDurationDays),
		MinSessionInteractionInterval:       int32(dSettings.MinSessionInteractionInterval),
		RetryTimeout:                        int32(dSettings.RetryTimeout),
		ProfileId:                           dSettings.ProfileID,
	}), nil
}

func (s *SettingsService) UpdateSettings(ctx context.Context, req *connect.Request[jules.UpdateSettingsRequest]) (*connect.Response[jules.Settings], error) {
	settings := req.Msg.Settings
	if settings == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("settings required"))
	}
	profileID := settings.ProfileId
	if profileID == "" {
		profileID = "default"
	}

	// Upsert
	query := `INSERT INTO settings (
		profile_id, idle_poll_interval, active_poll_interval, title_truncate_length, line_clamp,
		session_items_per_page, jobs_per_page, default_session_count, pr_status_poll_interval,
		theme, history_prompts_count, auto_approval_enabled, auto_approval_interval,
		auto_retry_enabled, auto_retry_message, auto_continue_enabled, auto_continue_message,
		session_cache_in_progress_interval, session_cache_completed_no_pr_interval,
		session_cache_pending_approval_interval, session_cache_max_age_days,
		auto_delete_stale_branches, auto_delete_stale_branches_after_days, auto_delete_stale_branches_interval,
		check_failing_actions_enabled, check_failing_actions_interval, check_failing_actions_threshold,
		close_pr_on_conflict_enabled, auto_close_stale_conflicted_prs, stale_conflicted_prs_duration_days,
		min_session_interaction_interval, retry_timeout
	) VALUES (
		:profile_id, :idle_poll_interval, :active_poll_interval, :title_truncate_length, :line_clamp,
		:session_items_per_page, :jobs_per_page, :default_session_count, :pr_status_poll_interval,
		:theme, :history_prompts_count, :auto_approval_enabled, :auto_approval_interval,
		:auto_retry_enabled, :auto_retry_message, :auto_continue_enabled, :auto_continue_message,
		:session_cache_in_progress_interval, :session_cache_completed_no_pr_interval,
		:session_cache_pending_approval_interval, :session_cache_max_age_days,
		:auto_delete_stale_branches, :auto_delete_stale_branches_after_days, :auto_delete_stale_branches_interval,
		:check_failing_actions_enabled, :check_failing_actions_interval, :check_failing_actions_threshold,
		:close_pr_on_conflict_enabled, :auto_close_stale_conflicted_prs, :stale_conflicted_prs_duration_days,
		:min_session_interaction_interval, :retry_timeout
	) ON CONFLICT(profile_id) DO UPDATE SET
		idle_poll_interval=excluded.idle_poll_interval,
		active_poll_interval=excluded.active_poll_interval,
		title_truncate_length=excluded.title_truncate_length,
		line_clamp=excluded.line_clamp,
		session_items_per_page=excluded.session_items_per_page,
		jobs_per_page=excluded.jobs_per_page,
		default_session_count=excluded.default_session_count,
		pr_status_poll_interval=excluded.pr_status_poll_interval,
		theme=excluded.theme,
		history_prompts_count=excluded.history_prompts_count,
		auto_approval_enabled=excluded.auto_approval_enabled,
		auto_approval_interval=excluded.auto_approval_interval,
		auto_retry_enabled=excluded.auto_retry_enabled,
		auto_retry_message=excluded.auto_retry_message,
		auto_continue_enabled=excluded.auto_continue_enabled,
		auto_continue_message=excluded.auto_continue_message,
		session_cache_in_progress_interval=excluded.session_cache_in_progress_interval,
		session_cache_completed_no_pr_interval=excluded.session_cache_completed_no_pr_interval,
		session_cache_pending_approval_interval=excluded.session_cache_pending_approval_interval,
		session_cache_max_age_days=excluded.session_cache_max_age_days,
		auto_delete_stale_branches=excluded.auto_delete_stale_branches,
		auto_delete_stale_branches_after_days=excluded.auto_delete_stale_branches_after_days,
		auto_delete_stale_branches_interval=excluded.auto_delete_stale_branches_interval,
		check_failing_actions_enabled=excluded.check_failing_actions_enabled,
		check_failing_actions_interval=excluded.check_failing_actions_interval,
		check_failing_actions_threshold=excluded.check_failing_actions_threshold,
		close_pr_on_conflict_enabled=excluded.close_pr_on_conflict_enabled,
		auto_close_stale_conflicted_prs=excluded.auto_close_stale_conflicted_prs,
		stale_conflicted_prs_duration_days=excluded.stale_conflicted_prs_duration_days,
		min_session_interaction_interval=excluded.min_session_interaction_interval,
		retry_timeout=excluded.retry_timeout;`

	dbSettings := db.Settings{
		ProfileID:                           profileID,
		IdlePollInterval:                    int(settings.IdlePollInterval),
		ActivePollInterval:                  int(settings.ActivePollInterval),
		TitleTruncateLength:                 int(settings.TitleTruncateLength),
		LineClamp:                           int(settings.LineClamp),
		SessionItemsPerPage:                 int(settings.SessionItemsPerPage),
		JobsPerPage:                         int(settings.JobsPerPage),
		DefaultSessionCount:                 int(settings.DefaultSessionCount),
		PrStatusPollInterval:                int(settings.PrStatusPollInterval),
		Theme:                               settings.Theme,
		HistoryPromptsCount:                 int(settings.HistoryPromptsCount),
		AutoApprovalEnabled:                 settings.AutoApprovalEnabled,
		AutoApprovalInterval:                int(settings.AutoApprovalInterval),
		AutoRetryEnabled:                    settings.AutoRetryEnabled,
		AutoRetryMessage:                    settings.AutoRetryMessage,
		AutoContinueEnabled:                 settings.AutoContinueEnabled,
		AutoContinueMessage:                 settings.AutoContinueMessage,
		SessionCacheInProgressInterval:      int(settings.SessionCacheInProgressInterval),
		SessionCacheCompletedNoPRInterval:   int(settings.SessionCacheCompletedNoPrInterval),
		SessionCachePendingApprovalInterval: int(settings.SessionCachePendingApprovalInterval),
		SessionCacheMaxAgeDays:              int(settings.SessionCacheMaxAgeDays),
		AutoDeleteStaleBranches:             settings.AutoDeleteStaleBranches,
		AutoDeleteStaleBranchesAfterDays:    int(settings.AutoDeleteStaleBranchesAfterDays),
		AutoDeleteStaleBranchesInterval:     int(settings.AutoDeleteStaleBranchesInterval),
		CheckFailingActionsEnabled:          settings.CheckFailingActionsEnabled,
		CheckFailingActionsInterval:         int(settings.CheckFailingActionsInterval),
		CheckFailingActionsThreshold:        int(settings.CheckFailingActionsThreshold),
		ClosePROnConflictEnabled:            settings.ClosePrOnConflictEnabled,
		AutoCloseStaleConflictedPRs:         settings.AutoCloseStaleConflictedPrs,
		StaleConflictedPRsDurationDays:      int(settings.StaleConflictedPrsDurationDays),
		MinSessionInteractionInterval:       int(settings.MinSessionInteractionInterval),
		RetryTimeout:                        int(settings.RetryTimeout),
	}

	_, err := db.DB.NamedExecContext(ctx, query, dbSettings)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(settings), nil
}
