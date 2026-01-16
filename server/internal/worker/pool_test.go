package worker

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestPoolFactory_NewPool(t *testing.T) {
	factory := GetPoolFactory()
	pool := factory.NewPool(2)
	assert.NotNil(t, pool)

	var wg sync.WaitGroup
	count := 0
	var mu sync.Mutex

	// Submit more tasks than workers to verify they run
	for i := 0; i < 5; i++ {
		wg.Add(1)
		pool.Submit(func() {
			defer wg.Done()
			mu.Lock()
			count++
			mu.Unlock()
			time.Sleep(10 * time.Millisecond)
		})
	}

	wg.Wait()
	pool.StopWait()

	assert.Equal(t, 5, count)
}
