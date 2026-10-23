package main

import "sync"

// Pipeline: a producer goroutine feeds a channel, `workers` goroutines read it (fan-out),
// and their results merge into one output channel (fan-in). Closing a channel is the
// shutdown signal; nobody needs a poison pill.
func Pipeline(inputs []int, workers int, work func(int) int) <-chan int {
	jobs := make(chan int, workers) // small buffer: producer can't run far ahead (backpressure)
	out := make(chan int, workers)

	go func() {
		defer close(jobs) // the producer owns jobs, so it closes it
		for _, n := range inputs {
			jobs <- n
		}
	}()

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for n := range jobs { // loop ends when jobs is closed and drained
				out <- work(n)
			}
		}()
	}

	go func() {
		wg.Wait()
		close(out) // close out only after every worker has finished sending
	}()
	return out
}
