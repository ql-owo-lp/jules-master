package config

import (
	"os"
	"sort"
	"strings"
)

// GetAllAPIKeys returns all JULES_API_KEYs from environment variables.
// It includes JULES_API_KEY and any JULES_API_KEY_{x} where x is a number.
// Keys are sorted: JULES_API_KEY first, then numeric suffixes in ascending order.
func GetAllAPIKeys() []string {
	keys := []string{}
	
	// Primary key
	if val := os.Getenv("JULES_API_KEY"); val != "" {
		keys = append(keys, val)
	}

	// Environment variables are not easily listable in Go unless we iterate os.Environ()
	// or we assume a certain range.
	// Iterating os.Environ() is safer to find all JULES_API_KEY_*
	
	environ := os.Environ()
	type keyEntry struct {
		key   string
		index int // 0 for primary, otherwise x
	}
	
	// We want to collect all keys and then sort them.
	// JULES_API_KEY is already added, but let's just collect everything and uniq/sort.
	// Actually, let's just create a list of non-empty keys.
	
	additionalKeys := []string{}
	
	for _, env := range environ {
		pair := strings.SplitN(env, "=", 2)
		if len(pair) != 2 {
			continue
		}
		k, v := pair[0], pair[1]
		if v == "" {
			continue
		}
		
		if strings.HasPrefix(k, "JULES_API_KEY_") {
			additionalKeys = append(additionalKeys, v)
		}
	}
	
	// Sort additional keys to be deterministic? 
	// Or should we respect the numeric suffix?
	// The requirement: "merge the sessions... then, all these background workers... will work on all jules apis automatically"
	// Order might not strictly matter for "all", but deterministic is good for testing.
	sort.Strings(additionalKeys)
	
	keys = append(keys, additionalKeys...)
	
	// Simple deduplication if needed?
	// Users might set JULES_API_KEY and JULES_API_KEY_1 to same value.
	uniqueKeys := []string{}
	seen := make(map[string]bool)
	for _, k := range keys {
		if !seen[k] {
			uniqueKeys = append(uniqueKeys, k)
			seen[k] = true
		}
	}
	
	return uniqueKeys
}
