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
			name:     "Valid JSON but not Google Error",
			input:    `{"foo": "bar"}`,
			expected: `{"foo": "bar"}`,
		},
		{
			name:     "Valid JSON with empty message",
			input:    `{"error": {"message": ""}}`,
			expected: `{"error": {"message": ""}}`,
		},
		{
			name:     "Plain text short",
			input:    "Short error message",
			expected: "Short error message",
		},
		{
			name:     "Plain text long - truncated",
			input:    strings.Repeat("a", 250),
			expected: strings.Repeat("a", 200) + "...",
		},
		{
			name:     "Empty body",
			input:    "",
			expected: "",
		},
		{
			name:     "Invalid JSON",
			input:    `{invalid json}`,
			expected: `{invalid json}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := sanitizeErrorBody([]byte(tc.input))
			assert.Equal(t, tc.expected, got)
		})
	}
}
