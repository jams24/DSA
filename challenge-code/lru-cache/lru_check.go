package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {
	c := NewCache[string, int](2, 0)
	c.Put("a", 1)
	c.Put("b", 2)
	if v, _ := c.Get("a"); v != 1 {
		panic("get a")
	}
	c.Put("c", 3)
	if _, ok := c.Get("b"); ok {
		panic("b should be evicted")
	}
	c.Put("a", 10)
	c.Put("d", 4)
	if _, ok := c.Get("c"); ok || c.Len() != 2 {
		panic("c should be evicted")
	}

	t0 := time.Unix(0, 0)
	now := t0
	tc := NewCache[string, int](10, 5*time.Second)
	tc.now = func() time.Time { return now }
	tc.Put("x", 1)
	now = t0.Add(4999 * time.Millisecond)
	if _, ok := tc.Get("x"); !ok {
		panic("fresh")
	}
	now = t0.Add(5 * time.Second)
	if _, ok := tc.Get("x"); ok || tc.Len() != 0 {
		panic("expired")
	}

	shared := NewCache[int, int](100, 0)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 1000; i++ {
				shared.Put(i%200, g)
				shared.Get(i % 150)
			}
		}(g)
	}
	wg.Wait()
	if shared.Len() != 100 {
		panic(shared.Len())
	}
	fmt.Println("ok")
}
