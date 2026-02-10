package service

import (
	"fmt"
	"regexp"
)

var (
	repoRegex   = regexp.MustCompile(`^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$`)
	branchRegex = regexp.MustCompile(`^[a-zA-Z0-9_./-]+$`)
)

func ValidateRepo(repo string) error {
	if repo == "" {
		return nil
	}
	if !repoRegex.MatchString(repo) {
		return fmt.Errorf("invalid repo format: must be 'owner/repo' and contain only alphanumeric, '-', '_', '.'")
	}
	return nil
}

func ValidateBranch(branch string) error {
	if branch == "" {
		return nil
	}
	if !branchRegex.MatchString(branch) {
		return fmt.Errorf("invalid branch format: contain only alphanumeric, '-', '_', '.', '/'")
	}
	return nil
}
