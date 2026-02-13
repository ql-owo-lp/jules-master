package service

import (
	"strings"
	"testing"
)

func TestValidateRepo(t *testing.T) {
	tests := []struct {
		name    string
		repo    string
		wantErr bool
	}{
		{"ValidRepo", "owner/repo", false},
		{"ValidRepoWithDash", "owner-name/repo-name", false},
		{"ValidRepoWithDot", "owner.name/repo.name", false},
		{"ValidRepoWithUnderscore", "owner_name/repo_name", false},
		{"EmptyRepo", "", false}, // Currently allows empty
		{"NoSlash", "ownerrepo", true},
		{"TwoSlashes", "owner/repo/extra", true}, // Regex enforces ^.../...$
		{"InvalidChars", "owner/repo!", true},
		{"PathTraversalStart", "../repo", true}, // Regex allows [.-] so .. matches
		{"PathTraversalEnd", "owner/..", true},
		{"PathTraversalMiddle", "../..", true},
		{"PathTraversalEncoded", "..%2f..", true}, // Regex excludes %
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRepo(tt.repo)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRepo(%q) error = %v, wantErr %v", tt.repo, err, tt.wantErr)
			}
			// Special check for path traversal if we expect error but regex passes (before fix)
			if tt.wantErr && err == nil && strings.Contains(tt.repo, "..") {
				t.Logf("Repo %q passed validation but should fail due to path traversal", tt.repo)
			}
		})
	}
}

func TestValidateBranch(t *testing.T) {
	tests := []struct {
		name    string
		branch  string
		wantErr bool
	}{
		{"ValidBranch", "main", false},
		{"ValidBranchWithSlash", "feature/new-feature", false},
		{"ValidBranchWithDot", "v1.0", false},
		{"EmptyBranch", "", false},
		{"InvalidChars", "branch!", true},
		{"PathTraversal", "../../etc/passwd", true}, // Regex allows / and .
		{"DoubleSlash", "feature//branch", true},
		{"LeadingSlash", "/branch", true},
		{"TrailingSlash", "branch/", true},
		{"JustDots", "..", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBranch(tt.branch)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateBranch(%q) error = %v, wantErr %v", tt.branch, err, tt.wantErr)
			}
			// Special check for path traversal if we expect error but regex passes (before fix)
			if tt.wantErr && err == nil && (strings.Contains(tt.branch, "..") || strings.Contains(tt.branch, "//")) {
				t.Logf("Branch %q passed validation but should fail due to path traversal/malformed path", tt.branch)
			}
		})
	}
}
