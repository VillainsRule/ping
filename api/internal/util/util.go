package util

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

func StripPort(host string) string {
	if idx := strings.LastIndex(host, ":"); idx >= 0 {
		return host[:idx]
	}
	return host
}

func JSONResp(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("json marshal error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data)
}
