package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetAllAPIKeys(t *testing.T) {
	t.Run("Single Primary Key", func(t *testing.T) {
		t.Setenv("JULES_API_KEY", "primary")
		// Clean other envs if possible?
		// We can't easily unset "everything", but likely no other JULES_ keys are set in CI env except what we set.
		// Detailed filtering might be needed if env is dirty.

		keys := GetAllAPIKeys()
		assert.Contains(t, keys, "primary")
	})

	t.Run("Multiple Keys", func(t *testing.T) {
		t.Setenv("JULES_API_KEY", "primary")
		t.Setenv("JULES_API_KEY_1", "secondary")
		t.Setenv("JULES_API_KEY_FOO", "tertiary") // Should be finding prefix JULES_API_KEY_

		keys := GetAllAPIKeys()
		assert.Contains(t, keys, "primary")
		assert.Contains(t, keys, "secondary")
		assert.Contains(t, keys, "tertiary")
		assert.Equal(t, 3, len(keys))
	})

	t.Run("Deduplication", func(t *testing.T) {
		t.Setenv("JULES_API_KEY", "same")
		t.Setenv("JULES_API_KEY_1", "same")

		keys := GetAllAPIKeys()
		assert.Equal(t, 1, len(keys))
		assert.Equal(t, "same", keys[0])
	})

	t.Run("Sorting", func(t *testing.T) {
		t.Setenv("JULES_API_KEY", "a")
		t.Setenv("JULES_API_KEY_1", "c")
		t.Setenv("JULES_API_KEY_2", "b")

		keys := GetAllAPIKeys()
		// Implementation puts primary first, then sorts others?
		// Code: keys = append(keys, additionalKeys...) where additionalKeys is sorted.
		// So "a", then "b", "c".

		assert.Equal(t, []string{"a", "b", "c"}, keys)
	})
}
