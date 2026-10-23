package main

import (
	"bufio"
	"io"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var (
	lineRe = regexp.MustCompile(`^(\S+) \S+ \S+ \[[^\]]+\] "([A-Z]+) (\S+) [^"]*" (\d{3}) (?:\d+|-) (\d+(?:\.\d+)?)$`)
	idRe   = regexp.MustCompile(`/(\d+|[0-9a-f]{8}-[0-9a-f-]{27})(/|$)`)
)

type EndpointStat struct {
	Endpoint string
	Count    int
	P95ms    int
}

type Report struct {
	Requests, Malformed int
	ErrorRate           float64
	TopEndpoints        []EndpointStat
}

func endpoint(method, path string) string {
	path, _, _ = strings.Cut(path, "?")
	return method + " " + idRe.ReplaceAllString(path, "/:id$2")
}

// Analyze streams the input line by line, so memory does not grow with file size
// (apart from per-endpoint latency samples).
func Analyze(r io.Reader, k int) (Report, error) {
	var rep Report
	counts := map[string]int{}
	lat := map[string][]float64{}
	errors := 0
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 1024*1024) // allow long lines
	for sc.Scan() {
		m := lineRe.FindStringSubmatch(strings.TrimSpace(sc.Text()))
		if m == nil {
			rep.Malformed++
			continue
		}
		secs, _ := strconv.ParseFloat(m[5], 64)
		ep := endpoint(m[2], m[3])
		counts[ep]++
		lat[ep] = append(lat[ep], secs)
		rep.Requests++
		if m[4][0] == '5' {
			errors++
		}
	}
	if err := sc.Err(); err != nil {
		return rep, err
	}
	if rep.Requests > 0 {
		rep.ErrorRate = math.Round(float64(errors)/float64(rep.Requests)*1e4) / 1e4
	}
	eps := make([]string, 0, len(counts))
	for ep := range counts {
		eps = append(eps, ep)
	}
	sort.Slice(eps, func(i, j int) bool {
		if counts[eps[i]] != counts[eps[j]] {
			return counts[eps[i]] > counts[eps[j]]
		}
		return eps[i] > eps[j]
	})
	for _, ep := range eps[:min(k, len(eps))] {
		v := lat[ep]
		sort.Float64s(v)
		p95 := v[max(0, int(math.Ceil(0.95*float64(len(v))))-1)]
		rep.TopEndpoints = append(rep.TopEndpoints, EndpointStat{ep, counts[ep], int(math.Round(p95 * 1000))})
	}
	return rep, nil
}
