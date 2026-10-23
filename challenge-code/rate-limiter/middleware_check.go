package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"time"
)

func main() {
	t0 := time.Unix(0, 0)
	clock := t0
	tb := NewTokenBucket(2, 0.5) // burst 2, then one every 2s
	tb.now = func() time.Time { return clock }

	hello := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("hi")) })
	h := RateLimit(tb, hello)
	hit := func(addr string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = addr
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	codes := []int{hit("1.1.1.1:5").Code, hit("1.1.1.1:6").Code, hit("1.1.1.1:7").Code}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != 429 {
		panic(fmt.Sprint(codes))
	}
	if ra := hit("1.1.1.1:8").Header().Get("Retry-After"); ra != "2" {
		panic("retry-after " + ra)
	}
	if hit("2.2.2.2:1").Code != 200 {
		panic("other client should pass")
	}
	clock = t0.Add(2 * time.Second)
	if hit("1.1.1.1:9").Code != 200 || hit("1.1.1.1:9").Code != 429 {
		panic("refill")
	}
	fmt.Println("ok")
}
