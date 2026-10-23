package main

import (
	"context"
	"sync"
)

type Result[T any] struct {
	Value T
	Err   error
}

// MapLimited runs fn over inputs with at most `limit` goroutines working at once.
// A buffered channel is the idiomatic Go semaphore: sending takes a slot, receiving frees it.
// Results keep input order; cancelling ctx stops tasks that haven't started.
func MapLimited[In, Out any](ctx context.Context, inputs []In, limit int, fn func(context.Context, In) (Out, error)) []Result[Out] {
	results := make([]Result[Out], len(inputs))
	sem := make(chan struct{}, limit)
	var wg sync.WaitGroup
	for i, in := range inputs {
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			for j := i; j < len(inputs); j++ {
				results[j].Err = ctx.Err()
			}
			wg.Wait()
			return results
		}
		wg.Add(1)
		go func() { // Go 1.22+: i and in are per-iteration, so capturing them is safe
			defer wg.Done()
			defer func() { <-sem }()
			v, err := fn(ctx, in)
			results[i] = Result[Out]{v, err} // each goroutine writes its own index: no lock needed
		}()
	}
	wg.Wait()
	return results
}
