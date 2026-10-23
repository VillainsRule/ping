package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"

	"ping/internal/auth"
	"ping/internal/db"
	"ping/internal/handlers"
	"ping/internal/ping"
	"ping/internal/util"
)

var pageHTML []byte

func loadIndexHTML() {
	data, err := os.ReadFile("../app/dist/index-page.html")
	if err != nil {
		log.Printf("warning: could not read index.html: %v", err)
		return
	}
	pageHTML = data
}

func main() {
	_ = godotenv.Load()

	if err := os.MkdirAll("data", 0755); err != nil {
		log.Fatal("failed to create data dir:", err)
	}

	if err := db.LoadDB(); err != nil {
		log.Fatal("failed to load DB:", err)
	}

	loadIndexHTML()

	ping.StartScheduler()
	go ping.CleanupRoutine()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/init", auth.HandleInit)
	mux.HandleFunc("GET /api/auth/callback", auth.HandleAuthCallback)
	mux.HandleFunc("POST /api/auth/logout", auth.HandleLogout)
	mux.HandleFunc("GET /api/public/status", handlers.HandlePublicStatus)

	mux.HandleFunc("GET /api/services", auth.RequireAuth(handlers.HandleGetServices))
	mux.HandleFunc("GET /api/services/history", auth.RequireAuth(handlers.HandleGetServicesHistory))
	mux.HandleFunc("POST /api/services", auth.RequireAuth(handlers.HandleCreateService))
	mux.HandleFunc("PUT /api/services/{id}", auth.RequireAuth(handlers.HandleUpdateService))
	mux.HandleFunc("DELETE /api/services/{id}", auth.RequireAuth(handlers.HandleDeleteService))

	mux.HandleFunc("GET /api/pages", auth.RequireAuth(handlers.HandleGetPages))
	mux.HandleFunc("POST /api/pages", auth.RequireAuth(handlers.HandleCreatePage))
	mux.HandleFunc("PUT /api/pages/{id}", auth.RequireAuth(handlers.HandleUpdatePage))
	mux.HandleFunc("DELETE /api/pages/{id}", auth.RequireAuth(handlers.HandleDeletePage))
	mux.HandleFunc("GET /api/pages/{id}/status", auth.RequireAuth(handlers.HandlePageStatus))
	mux.HandleFunc("GET /api/pages/by-name/{name}/status", auth.RequireAuth(handlers.HandlePageStatusByName))

	mux.Handle("/", http.HandlerFunc(serveSPA))

	log.Printf("ping $ http://localhost:4406")
	log.Fatal(http.ListenAndServe(":4406", mux))
}

func serveSSRStatusPage(w http.ResponseWriter, pageStatus handlers.PageStatusResponse) {
	ssrData, err := json.Marshal(pageStatus)
	if err != nil {
		log.Printf("ssr marshal error: %v", err)
		w.Write(pageHTML)
		return
	}

	script := []byte("<script>window.__SSR__=" + string(ssrData) + "</script></head>")
	out := bytes.Replace(pageHTML, []byte("</head>"), script, 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(out)
}

func serveSPA(w http.ResponseWriter, r *http.Request) {
	dist := "../app/dist/"
	path := r.URL.Path
	host := util.StripPort(r.Host)
	page := db.FindPageByHost(host)

	if path != "/" && path != "/index.html" {
		fp := filepath.Join(dist, filepath.Clean("/"+path))
		if _, err := os.Stat(fp); err == nil {
			http.ServeFile(w, r, fp)
			return
		}
	}

	if page != nil && len(pageHTML) > 0 {
		serveSSRStatusPage(w, handlers.BuildPageStatus(page))
		return
	}

	http.ServeFile(w, r, dist+"/index-admin.html")
}
