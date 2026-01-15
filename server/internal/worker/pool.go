package worker

import (
	"sync"

	"github.com/gammazero/workerpool"
)

// PoolFactory manages standard worker pools
type PoolFactory struct {
	// We can add global metrics or unified limits here later
	once sync.Once
}

var globalFactory *PoolFactory

func GetPoolFactory() *PoolFactory {
	if globalFactory == nil {
		globalFactory = &PoolFactory{}
	}
	return globalFactory
}

// NewPool creates a new worker pool with the specified max concurrency
func (f *PoolFactory) NewPool(maxWorkers int) *workerpool.WorkerPool {
	return workerpool.New(maxWorkers)
}
