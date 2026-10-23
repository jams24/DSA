package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"strconv"
	"time"
)

type Client struct {
	HTTP        *http.Client // set Timeout on it, e.g. &http.Client{Timeout: 5 * time.Second}
	BaseURL     string
	MaxAttempts int
	Sleep       func(ctx context.Context, d time.Duration) error
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func retryable(code int) bool {
	return code == 408 || code == 429 || code >= 500
}

// backoff is exponential with full jitter, capped at 5s.
func backoff(attempt int) time.Duration {
	ceil := min(5*time.Second, 200*time.Millisecond<<attempt)
	return time.Duration(rand.Int64N(int64(ceil) + 1))
}

func (c *Client) getJSON(ctx context.Context, path string, out any) error {
	sleep := c.Sleep
	if sleep == nil {
		sleep = sleepCtx
	}
	var lastErr error
	for attempt := 0; attempt < c.MaxAttempts; attempt++ {
		if attempt > 0 {
			if err := sleep(ctx, lastWait(lastErr, attempt-1)); err != nil {
				return err // the caller cancelled: stop retrying
			}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path, nil)
		if err != nil {
			return err
		}
		resp, err := c.HTTP.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			lastErr = err // network error or client timeout: retry
			continue
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode < 400 {
			return json.Unmarshal(body, out)
		}
		statusErr := &StatusError{Code: resp.StatusCode, RetryAfter: resp.Header.Get("Retry-After")}
		if !retryable(resp.StatusCode) {
			return statusErr
		}
		lastErr = statusErr
	}
	return fmt.Errorf("GET %s: giving up after %d attempts: %w", path, c.MaxAttempts, lastErr)
}

type StatusError struct {
	Code       int
	RetryAfter string
}

func (e *StatusError) Error() string { return "unexpected status " + strconv.Itoa(e.Code) }

// lastWait honors Retry-After (in seconds) when the server sent one, else backs off.
func lastWait(err error, attempt int) time.Duration {
	if se, ok := err.(*StatusError); ok {
		if s, convErr := strconv.Atoi(se.RetryAfter); convErr == nil && s >= 0 {
			return min(time.Duration(s)*time.Second, 30*time.Second)
		}
	}
	return backoff(attempt)
}

// FetchAll follows ?page=N until next_page is null.
func (c *Client) FetchAll(ctx context.Context) ([]int, error) {
	var all []int
	for page := 1; page != 0; {
		var data struct {
			Items    []int `json:"items"`
			NextPage *int  `json:"next_page"`
		}
		if err := c.getJSON(ctx, "/items?page="+strconv.Itoa(page), &data); err != nil {
			return nil, err
		}
		all = append(all, data.Items...)
		page = 0
		if data.NextPage != nil {
			page = *data.NextPage
		}
	}
	return all, nil
}
