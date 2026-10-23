package main

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"
)

func main() {
	var active, peak atomic.Int32
	square := func(ctx context.Context, n int) (int, error) {
		cur := active.Add(1)
		for {
			p := peak.Load()
			if cur <= p || peak.CompareAndSwap(p, cur) {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
		active.Add(-1)
		if n == 3 {
			return 0, errors.New("three")
		}
		return n * n, nil
	}
	res := MapLimited(context.Background(), []int{1, 2, 3, 4, 5, 6}, 2, square)
	if peak.Load() != 2 {
		panic(fmt.Sprint("peak ", peak.Load()))
	}
	if res[0].Value != 1 || res[5].Value != 36 || res[2].Err == nil {
		panic(fmt.Sprint(res))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	slow := func(ctx context.Context, n int) (int, error) {
		select {
		case <-time.After(50 * time.Millisecond):
			return n, nil
		case <-ctx.Done():
			return 0, ctx.Err()
		}
	}
	res = MapLimited(ctx, make([]int, 10), 2, slow)
	for _, r := range res {
		if !errors.Is(r.Err, context.DeadlineExceeded) {
			panic(fmt.Sprint("expected deadline: ", res))
		}
	}
	fmt.Println("ok")
}
