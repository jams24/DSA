package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
)

func check(ok bool, msg string) {
	if !ok {
		panic(msg)
	}
}

func main() {
	h := NewShortener().Routes()
	do := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	r := do("POST", "/shorten", `{"url":"https://example.com/a"}`)
	check(r.Code == http.StatusCreated, "create")
	var out map[string]string
	json.Unmarshal(r.Body.Bytes(), &out)
	code := out["code"]
	check(len(code) == 7, "code length")

	r = do("POST", "/shorten", `{"url":"https://example.com/a"}`)
	json.Unmarshal(r.Body.Bytes(), &out)
	check(r.Code == http.StatusOK && out["code"] == code, "same url, same code")

	r = do("GET", "/"+code, "")
	check(r.Code == http.StatusFound && r.Header().Get("Location") == "https://example.com/a", "redirect")
	var st link
	json.Unmarshal(do("GET", "/stats/"+code, "").Body.Bytes(), &st)
	check(st.Hits == 1, "hits")
	check(do("GET", "/missing", "").Code == 404, "404")

	check(do("POST", "/shorten", `{"url":"ftp://x"}`).Code == 400, "bad url")
	check(do("POST", "/shorten", `{"url":"https://example.com/b","alias":"promo"}`).Code == 201, "alias")
	check(do("POST", "/shorten", `{"url":"https://example.com/c","alias":"promo"}`).Code == 409, "alias taken")

	limited := false
	for i := 0; i < 12; i++ {
		if do("POST", "/shorten", fmt.Sprintf(`{"url":"https://example.com/%d"}`, i)).Code == 429 {
			limited = true
		}
	}
	check(limited, "rate limit")
	fmt.Println("ok")
}
