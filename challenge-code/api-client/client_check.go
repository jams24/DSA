package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync"
	"time"
)

func main() {
	var mu sync.Mutex
	hits := map[string]int{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		hits[r.URL.RawQuery]++
		n := hits[r.URL.RawQuery]
		mu.Unlock()
		switch {
		case r.URL.Path == "/missing":
			w.WriteHeader(404)
		case r.URL.RawQuery == "page=1" && n == 1:
			w.WriteHeader(503)
		case r.URL.RawQuery == "page=2" && n == 1:
			w.Header().Set("Retry-After", "2")
			w.WriteHeader(429)
		case r.URL.RawQuery == "page=1":
			fmt.Fprint(w, `{"items":[10,11],"next_page":2}`)
		default:
			fmt.Fprint(w, `{"items":[20],"next_page":null}`)
		}
	}))
	defer srv.Close()

	var slept []time.Duration
	c := &Client{HTTP: &http.Client{Timeout: 2 * time.Second}, BaseURL: srv.URL, MaxAttempts: 4,
		Sleep: func(ctx context.Context, d time.Duration) error { slept = append(slept, d); return nil }}
	items, err := c.FetchAll(context.Background())
	if err != nil || !reflect.DeepEqual(items, []int{10, 11, 20}) {
		panic(fmt.Sprint(items, err))
	}
	if len(slept) != 2 || slept[0] > 200*time.Millisecond || slept[1] != 2*time.Second {
		panic(fmt.Sprint(slept))
	}

	var out any
	var se *StatusError
	if err := c.getJSON(context.Background(), "/missing", &out); !errors.As(err, &se) || se.Code != 404 || hits[""] != 1 {
		panic(fmt.Sprint("404 should fail fast: ", err))
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := c.FetchAll(ctx); !errors.Is(err, context.Canceled) {
		panic(fmt.Sprint("cancel: ", err))
	}
	fmt.Println("ok")
}
