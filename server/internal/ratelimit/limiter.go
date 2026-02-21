package ratelimit

import (
	"fmt"
	"sync"
	"time"
)

type Limiter struct {
	mu       sync.Mutex
	lastSeen map[string]time.Time
	interval time.Duration
	stopCh   chan struct{}
}

func New(interval time.Duration) *Limiter {
	if interval == 0 {
		interval = 100 * time.Millisecond
	}
	l := &Limiter{
		lastSeen: make(map[string]time.Time),
		interval: interval,
		stopCh:   make(chan struct{}),
	}
	go l.cleanupLoop()
	return l
}

func (l *Limiter) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			l.mu.Lock()
			threshold := time.Now().Add(-1 * time.Minute)
			for k, t := range l.lastSeen {
				if t.Before(threshold) {
					delete(l.lastSeen, k)
				}
			}
			l.mu.Unlock()
		case <-l.stopCh:
			return
		}
	}
}

func (l *Limiter) Stop() {
	close(l.stopCh)
}

func (l *Limiter) Check(key string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	last, exists := l.lastSeen[key]

	if exists && now.Sub(last) < l.interval {
		return fmt.Errorf("rate limit exceeded: please slow down")
	}

	l.lastSeen[key] = now
	return nil
}
