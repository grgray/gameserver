package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// writeStaticDir lays out a minimal built-frontend directory: an index.html
// and one asset file, so static-serving tests have something real to hit.
func writeStaticDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	index := filepath.Join(dir, "index.html")
	if err := os.WriteFile(index, []byte("<html><body>tic-tac-toe</body></html>"), 0o644); err != nil {
		t.Fatalf("writing index.html: %v", err)
	}

	asset := filepath.Join(dir, "assets", "app.js")
	if err := os.MkdirAll(filepath.Dir(asset), 0o755); err != nil {
		t.Fatalf("mkdir assets: %v", err)
	}
	if err := os.WriteFile(asset, []byte("console.log('app');"), 0o644); err != nil {
		t.Fatalf("writing app.js: %v", err)
	}

	return dir
}

func newStaticTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(NewServer().WithStatic(writeStaticDir(t)).Handler())
	t.Cleanup(ts.Close)
	return ts
}

func TestServerStaticServesIndex(t *testing.T) {
	ts := newStaticTestServer(t)

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("GET /: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("Content-Type = %q, want text/html", ct)
	}
}

func TestServerStaticServesAsset(t *testing.T) {
	ts := newStaticTestServer(t)

	resp, err := http.Get(ts.URL + "/assets/app.js")
	if err != nil {
		t.Fatalf("GET asset: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
}

func TestServerStaticSPAFallback(t *testing.T) {
	ts := newStaticTestServer(t)

	// A client-side route that has no matching file must still load the app.
	resp, err := http.Get(ts.URL + "/some/client/route")
	if err != nil {
		t.Fatalf("GET fallback: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
}

func TestServerStaticStillServesAPI(t *testing.T) {
	ts := newStaticTestServer(t)

	var got stateResponse
	code := postJSON(t, ts.URL+"/games", nil, &got)

	if code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", code, http.StatusCreated)
	}
	if got.ID == "" {
		t.Error("created game has no ID")
	}
}
