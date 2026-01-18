package worker

import (
	"context"
	"sync"
	"time"

	"github.com/mcpany/jules/internal/logger"
)

type Worker interface {
	Name() string
	Start(ctx context.Context) error
}

type Manager struct {
	workers []Worker
	wg      sync.WaitGroup
	ctx     context.Context
	cancel  context.CancelFunc
}

func NewManager() *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		ctx:    ctx,
		cancel: cancel,
	}
}

func (m *Manager) Register(w Worker) {
	m.workers = append(m.workers, w)
}

func (m *Manager) Start() {
	for _, w := range m.workers {
		m.wg.Add(1)
		go func(w Worker) {
			defer m.wg.Done()
			logger.Info("Starting worker: %s", w.Name())
			if err := w.Start(m.ctx); err != nil {
				logger.Error("Worker %s failed: %s", w.Name(), err.Error())
			}
			logger.Info("Worker stopped: %s", w.Name())
		}(w)
	}
}

func (m *Manager) Stop() {
	m.cancel()
	m.wg.Wait()
}

// BaseWorker provides common functionality
type BaseWorker struct {
	NameStr  string
	Interval time.Duration
}

func (b *BaseWorker) Name() string {
	return b.NameStr
}
