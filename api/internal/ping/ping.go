package ping

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"ping/internal/auth"
	"ping/internal/db"
	"sync"
	"time"
)

var (
	pingersMu sync.Mutex
	pingers   = map[string]chan struct{}{}
)

func StartScheduler() {
	db.ServicesMu.RLock()
	svcs := make([]db.Service, len(db.Services))
	copy(svcs, db.Services)
	db.ServicesMu.RUnlock()

	for _, svc := range svcs {
		StartPinger(svc)
	}
}

func StartPinger(svc db.Service) {
	pingersMu.Lock()
	if ch, ok := pingers[svc.ID]; ok {
		close(ch)
	}
	stop := make(chan struct{})
	pingers[svc.ID] = stop
	pingersMu.Unlock()

	interval := svc.IntervalSeconds
	if interval <= 0 {
		interval = 10
	}

	go func() {
		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				DoPing(svc.ID, svc.URL)
			case <-stop:
				return
			}
		}
	}()
}

func StopPinger(id string) {
	pingersMu.Lock()
	defer pingersMu.Unlock()
	if ch, ok := pingers[id]; ok {
		close(ch)
		delete(pingers, id)
	}
}

var pingClient = &http.Client{Timeout: 15 * time.Second}

func DoPing(serviceID, url string) {
	statusCode, success := doSinglePing(url)
	if !success && statusCode == 0 {
		statusCode, success = doSinglePing(url)
	}
	recordResult(serviceID, success, statusCode)
}

func doSinglePing(url string) (statusCode int, success bool) {
	resp, err := pingClient.Get(url)
	if err != nil {
		if isTimeout(err) {
			return 0, false
		}
		return 0, false
	}
	defer resp.Body.Close()
	return resp.StatusCode, resp.StatusCode >= 200 && resp.StatusCode < 300
}

func isTimeout(err error) bool {
	if err == nil {
		return false
	}
	netErr, ok := err.(net.Error)
	return ok && netErr.Timeout()
}

func recordResult(serviceID string, success bool, statusCode int) {
	now := time.Now().UnixMilli()

	db.DowntimeMu.Lock()
	defer db.DowntimeMu.Unlock()

	openIdx := -1
	for i := range db.Incidents {
		if db.Incidents[i].ServiceID == serviceID && db.Incidents[i].End == nil {
			openIdx = i
			break
		}
	}

	if !success && openIdx == -1 {
		inc := db.Incident{
			ID:         auth.NewID(),
			ServiceID:  serviceID,
			Start:      now,
			StatusCode: statusCode,
		}
		db.Incidents = append(db.Incidents, inc)
		db.SaveDowntime()
		go sendDiscordDown(serviceID, statusCode)
	} else if success && openIdx >= 0 {
		end := now
		db.Incidents[openIdx].End = &end
		db.SaveDowntime()
		go sendDiscordUp(serviceID)
	}
}

func serviceNameByID(id string) string {
	db.ServicesMu.RLock()
	defer db.ServicesMu.RUnlock()
	for _, s := range db.Services {
		if s.ID == id {
			return s.Name
		}
	}
	return id
}

func sendDiscordDown(serviceID string, statusCode int) {
	webhook := os.Getenv("DISCORD_WEBHOOK")
	if webhook == "" {
		return
	}
	name := serviceNameByID(serviceID)
	desc := fmt.Sprintf("**%s** is down\n-# @here", name)
	if statusCode != 0 {
		desc += fmt.Sprintf(" (HTTP %d)", statusCode)
	} else {
		desc += " (timeout)"
	}
	sendDiscordEmbed(webhook, desc, 0xED4245)
}

func sendDiscordUp(serviceID string) {
	webhook := os.Getenv("DISCORD_WEBHOOK")
	if webhook == "" {
		return
	}
	name := serviceNameByID(serviceID)
	sendDiscordEmbed(webhook, fmt.Sprintf("**%s** is back up", name), 0x57F287)
}

var DISCORD_CONTAINER_TYPE int = 17
var DISCORD_TEXT_COMPONENT_TYPE int = 10

func sendDiscordEmbed(webhook, description string, color int) {
	payload, _ := json.Marshal(map[string]any{
		"components": []map[string]any{
			{
				"type": DISCORD_CONTAINER_TYPE,
				"components": []map[string]any{
					{
						"type":    DISCORD_TEXT_COMPONENT_TYPE,
						"content": description,
					},
				},
				"accent_color": color,
			},
		},
		"flags": 32768,
	})
	resp, err := http.Post(webhook+"?with_components=true", "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("discord webhook error: %v", err)
		return
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("discord error %d: %s", resp.StatusCode, body)
	}
}

func CleanupRoutine() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		pruneOldIncidents()
	}
}

func pruneOldIncidents() {
	cutoff := time.Now().AddDate(0, 0, -30).UnixMilli()

	db.DowntimeMu.Lock()
	defer db.DowntimeMu.Unlock()

	kept := db.Incidents[:0]
	for _, inc := range db.Incidents {
		if inc.End == nil || *inc.End >= cutoff {
			kept = append(kept, inc)
		}
	}

	if len(kept) != len(db.Incidents) {
		db.Incidents = kept
		db.SaveDowntime()
	}
}
