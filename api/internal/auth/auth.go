package auth

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"ping/internal/db"
	"ping/internal/util"
	"sync"
)

var (
	sessionsMu sync.RWMutex
	sessions   = map[string]struct{}{}
)

func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func NewSession() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func IsLoggedIn(r *http.Request) bool {
	c, err := r.Cookie("session")
	if err != nil {
		return false
	}
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()
	_, ok := sessions[c.Value]
	return ok
}

func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host := util.StripPort(r.Host)
		if db.IsStatusPageHost(host) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if !IsLoggedIn(r) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func VoauthURL(r *http.Request) string {
	scheme := "https"
	if util.StripPort(r.Host) == "localhost" {
		scheme = "http"
	}
	origin := fmt.Sprintf("%s://%s", scheme, r.Host)
	cbURL := fmt.Sprintf("%s/api/auth/callback", origin)
	return fmt.Sprintf("%s/oauth/v1?client_id=%s&redirect_uri=%s",
		os.Getenv("VOAUTH_HOST"),
		os.Getenv("VOAUTH_CLIENT_ID"),
		url.QueryEscape(cbURL),
	)
}

func HandleInit(w http.ResponseWriter, r *http.Request) {
	host := util.StripPort(r.Host)
	page := db.FindPageByHost(host)
	if page != nil {
		util.JSONResp(w, map[string]any{
			"mode": "statuspage",
			"page": page,
		})
		return
	}
	loggedIn := IsLoggedIn(r)
	util.JSONResp(w, map[string]any{
		"mode":      "admin",
		"loggedIn":  loggedIn,
		"voauthUrl": VoauthURL(r),
	})
}

func HTTPPost(url, contentType string, body []byte) (*http.Response, error) {
	return http.Post(url, contentType, bytes.NewReader(body))
}

func HandleAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	type validateReq struct {
		AppID     string `json:"appId"`
		AppSecret string `json:"appSecret"`
		Code      string `json:"code"`
	}
	type userObj struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
	}
	type validateResp struct {
		Error string  `json:"error"`
		User  userObj `json:"user"`
	}

	body, _ := json.Marshal(validateReq{
		AppID:     os.Getenv("VOAUTH_CLIENT_ID"),
		AppSecret: os.Getenv("VOAUTH_CLIENT_SECRET"),
		Code:      code,
	})

	resp, err := HTTPPost(
		fmt.Sprintf("%s/api/v1/oauth/validate", os.Getenv("VOAUTH_HOST")),
		"application/json",
		body,
	)
	if err != nil {
		http.Error(w, "upstream error", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var vr validateResp
	if err := json.NewDecoder(resp.Body).Decode(&vr); err != nil {
		http.Error(w, "bad response", http.StatusBadGateway)
		return
	}
	if vr.Error != "" {
		http.Error(w, vr.Error, http.StatusUnauthorized)
		return
	}
	if fmt.Sprintf("%d", vr.User.ID) != os.Getenv("VOAUTH_USER_ID") {
		http.Error(w, "unauthorized user", http.StatusUnauthorized)
		return
	}

	sid := NewSession()
	sessionsMu.Lock()
	sessions[sid] = struct{}{}
	sessionsMu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    sid,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   true,
	})
	http.Redirect(w, r, "/", http.StatusFound)
}

func HandleLogout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("session")
	if err == nil {
		sessionsMu.Lock()
		delete(sessions, c.Value)
		sessionsMu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:   "session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	util.JSONResp(w, map[string]any{"ok": true})
}
