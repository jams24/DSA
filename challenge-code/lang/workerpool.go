package main

import (
	"context"
	"sync"
)

// RunAll processes jobs with a fixed pool of workers. The first error cancels the shared
// context so the other workers stop early (what golang.org/x/sync/errgroup does for you),
// and RunAll returns that first error.
func RunAll[J any](ctx context.Context, jobs []J, workers int, fn func(context.Context, J) error) error {
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)

	feed := make(chan J)
	var wg sync.WaitGroup
	var once sync.Once
	var firstErr error

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range feed {
				if err := fn(ctx, j); err != nil {
					once.Do(func() {
						firstErr = err
						cancel(err)
					})
					return
				}
			}
		}()
	}

feeding:
	for _, j := range jobs {
		select {
		case feed <- j:
		case <-ctx.Done(): // stop handing out work once something failed or the caller gave up
			break feeding
		}
	}
	close(feed)
	wg.Wait()
	if firstErr != nil {
		return firstErr
	}
	return ctx.Err() // the parent's cancellation or deadline, if any
}
