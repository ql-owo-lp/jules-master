package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeErrorBody(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Valid Google Error",
			input:    `{"error": {"code": 400, "message": "Invalid argument", "status": "INVALID_ARGUMENT"}}`,
			expected: "Invalid argument",
		},
		{
			name:     "Valid Google Error with other fields",
			input:    `{"error": {"message": "Permission denied", "details": ["foo", "bar"]}}`,
			expected: "Permission denied",
		},
		{
			name:     "JSON but not Google Error format",
			input:    `{"status": "failed", "reason": "unknown"}`,
			expected: `{"status": "failed", "reason": "unknown"}`,
		},
		{
			name:     "Plain text short",
			input:    "Internal Server Error",
			expected: "Internal Server Error",
		},
		{
			name:     "Plain text long - should be truncated",
			input:    strings.Repeat("a", 300),
			expected: strings.Repeat("a", 200) + "...",
		},
		{
			name:     "UTF-8 truncation",
			input:    strings.Repeat("😊", 205),
			expected: strings.Repeat("😊", 200) + "...",
		},
		{
			name:     "Empty body",
			input:    "",
			expected: "",
		},
		{
			name:     "Invalid JSON",
			input:    `{"error": {`,
			expected: `{"error": {`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := sanitizeErrorBody([]byte(tc.input))
			assert.Equal(t, tc.expected, got)
		})
	}
}
