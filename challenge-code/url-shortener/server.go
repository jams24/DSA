package main

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"sync"
	"time"
)

const (
	alphabet  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	codeLen   = 7
	rateLimit = 10 // creates per client per window
	window    = time.Minute
)

var aliasRe = regexp.MustCompile(`^[A-Za-z0-9]{3,32}$`)

type link struct {
	URL  string `json:"url"`
	Hits int    `json:"hits"`
}

type Shortener struct {
	mu     sync.Mutex
	links  map[string]*link
	byURL  map[string]string
	recent map[string][]time.Time
	now    func() time.Time
}

func NewShortener() *Shortener {
	return &Shortener{links: map[string]*link{}, byURL: map[string]string{}, recent: map[string][]time.Time{}, now: time.Now}
}

// Routes uses Go 1.22+ method and wildcard patterns.
func (s *Shortener) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /shorten", s.shorten)
	mux.HandleFunc("GET /stats/{code}", s.stats)
	mux.HandleFunc("GET /{code}", s.follow)
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// allow must be called with s.mu held.
func (s *Shortener) allow(client string) bool {
	now := s.now()
	kept := s.recent[client][:0]
	for _, t := range s.recent[client] {
		if now.Sub(t) < window {
			kept = append(kept, t)
		}
	}
	if len(kept) >= rateLimit {
		s.recent[client] = kept
		return false
	}
	s.recent[client] = append(kept, now)
	return true
}

func (s *Shortener) newCode() string {
	for {
		b := make([]byte, codeLen)
		for i := range b {
			n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
			b[i] = alphabet[n.Int64()]
		}
		if _, taken := s.links[string(b)]; !taken {
			return string(b)
		}
	}
}

func (s *Shortener) shorten(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL   string  `json:"url"`
		Alias *string `json:"alias"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&body); err != nil {
		fail(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	u, err := url.Parse(body.URL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		fail(w, http.StatusBadRequest, "url must be an absolute http(s) URL")
		return
	}
	client, _, _ := net.SplitHostPort(r.RemoteAddr)

	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.allow(client) {
		w.Header().Set("Retry-After", "60")
		fail(w, http.StatusTooManyRequests, "rate limit exceeded")
		return
	}
	status := http.StatusCreated
	var code string
	switch {
	case body.Alias != nil:
		if !aliasRe.MatchString(*body.Alias) {
			fail(w, http.StatusBadRequest, "alias must be 3-32 letters or digits")
			return
		}
		if _, taken := s.links[*body.Alias]; taken {
			fail(w, http.StatusConflict, "alias already taken")
			return
		}
		code = *body.Alias
	case s.byURL[body.URL] != "":
		code, status = s.byURL[body.URL], http.StatusOK
	default:
		code = s.newCode()
		s.byURL[body.URL] = code
	}
	if s.links[code] == nil {
		s.links[code] = &link{URL: body.URL}
	}
	writeJSON(w, status, map[string]string{"code": code, "url": body.URL, "shortUrl": "http://" + r.Host + "/" + code})
}

func (s *Shortener) stats(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	l := s.links[r.PathValue("code")]
	if l == nil {
		fail(w, http.StatusNotFound, "unknown code")
		return
	}
	writeJSON(w, http.StatusOK, l)
}

func (s *Shortener) follow(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	l := s.links[r.PathValue("code")]
	if l != nil {
		l.Hits++
	}
	s.mu.Unlock()
	if l == nil {
		fail(w, http.StatusNotFound, "unknown code")
		return
	}
	http.Redirect(w, r, l.URL, http.StatusFound)
}

// In production: http.ListenAndServe(":8080", NewShortener().Routes())
