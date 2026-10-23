package main

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// TokenBucket refills `rate` tokens per second up to `capacity`, per key.
type TokenBucket struct {
	mu       sync.Mutex
	capacity float64
	rate     float64
	buckets  map[string]*bucket
	now      func() time.Time
}

type bucket struct {
	tokens float64
	last   time.Time
}

func NewTokenBucket(capacity, rate float64) *TokenBucket {
	return &TokenBucket{capacity: capacity, rate: rate, buckets: map[string]*bucket{}, now: time.Now}
}

// Allow reports whether a request may proceed and, if not, how long until one token is available.
func (tb *TokenBucket) Allow(key string) (bool, time.Duration) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	now := tb.now()
	b, ok := tb.buckets[key]
	if !ok {
		b = &bucket{tokens: tb.capacity, last: now}
		tb.buckets[key] = b
	}
	b.tokens = math.Min(tb.capacity, b.tokens+now.Sub(b.last).Seconds()*tb.rate)
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	wait := time.Duration((1 - b.tokens) / tb.rate * float64(time.Second))
	return false, wait
}

// RateLimit wraps a handler and answers 429 with Retry-After once a client's bucket is empty.
func RateLimit(tb *TokenBucket, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			key = r.RemoteAddr
		}
		if ok, wait := tb.Allow(key); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
