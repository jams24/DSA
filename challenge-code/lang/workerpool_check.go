package main

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"
)

func main() {
	var done atomic.Int32
	err := RunAll(context.Background(), make([]int, 50), 5, func(ctx context.Context, _ int) error {
		time.Sleep(time.Millisecond)
		done.Add(1)
		return nil
	})
	if err != nil || done.Load() != 50 {
		panic(fmt.Sprint(err, done.Load()))
	}

	boom := errors.New("job 3 failed")
	var started atomic.Int32
	jobs := make([]int, 100)
	for i := range jobs {
		jobs[i] = i
	}
	err = RunAll(context.Background(), jobs, 4, func(ctx context.Context, j int) error {
		started.Add(1)
		if j == 3 {
			return boom
		}
		select {
		case <-time.After(20 * time.Millisecond):
			return nil
		case <-ctx.Done():
			return nil
		}
	})
	if !errors.Is(err, boom) {
		panic(fmt.Sprint("want boom, got ", err))
	}
	if started.Load() > 20 {
		panic(fmt.Sprint("cancellation should stop feeding work, started ", started.Load()))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Millisecond)
	defer cancel()
	err = RunAll(ctx, jobs, 2, func(ctx context.Context, _ int) error {
		time.Sleep(10 * time.Millisecond)
		return nil
	})
	if !errors.Is(err, context.DeadlineExceeded) {
		panic(fmt.Sprint("want deadline, got ", err))
	}
	fmt.Println("ok")
}
