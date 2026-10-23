package handlers

import (
	"encoding/json"
	"net/http"
	"ping/internal/auth"
	"ping/internal/db"
	"ping/internal/ping"
	"ping/internal/util"
	"sort"
	"time"
)

func HandleGetServices(w http.ResponseWriter, r *http.Request) {
	db.ServicesMu.RLock()
	svcs := make([]db.Service, len(db.Services))
	copy(svcs, db.Services)
	db.ServicesMu.RUnlock()

	db.DowntimeMu.RLock()
	incs := make([]db.Incident, len(db.Incidents))
	copy(incs, db.Incidents)
	db.DowntimeMu.RUnlock()

	type ServiceWithStatus struct {
		db.Service
		Up                bool `json:"up"`
		CurrentStatusCode *int `json:"currentStatusCode"`
	}

	result := make([]ServiceWithStatus, len(svcs))
	for i, svc := range svcs {
		sws := ServiceWithStatus{Service: svc, Up: true}
		for _, inc := range incs {
			if inc.ServiceID == svc.ID && inc.End == nil {
				sws.Up = false
				sc := inc.StatusCode
				sws.CurrentStatusCode = &sc
				break
			}
		}
		result[i] = sws
	}

	tagSet := map[string]struct{}{}
	for _, svc := range svcs {
		if svc.Tag != "" {
			tagSet[svc.Tag] = struct{}{}
		}
	}
	tags := make([]string, 0, len(tagSet))
	for t := range tagSet {
		tags = append(tags, t)
	}
	sort.Strings(tags)

	util.JSONResp(w, map[string]any{"services": result, "tags": tags})
}

func HandleGetServicesHistory(w http.ResponseWriter, r *http.Request) {
	db.ServicesMu.RLock()
	svcs := make([]db.Service, len(db.Services))
	copy(svcs, db.Services)
	db.ServicesMu.RUnlock()

	db.DowntimeMu.RLock()
	incs := make([]db.Incident, len(db.Incidents))
	copy(incs, db.Incidents)
	db.DowntimeMu.RUnlock()

	now := time.Now()
	nowMs := now.UnixMilli()
	cutoff24 := now.Add(-24 * time.Hour).UnixMilli()

	type ServiceHistory struct {
		ID     string        `json:"id"`
		Hour24 []HourHistory `json:"hour24"`
	}

	result := make([]ServiceHistory, 0, len(svcs))
	for _, svc := range svcs {
		var relevantIncs []db.Incident
		for _, inc := range incs {
			if inc.ServiceID != svc.ID {
				continue
			}
			incEnd := nowMs
			if inc.End != nil {
				incEnd = *inc.End
			}
			if incEnd < cutoff24 {
				continue
			}
			relevantIncs = append(relevantIncs, inc)
		}
		result = append(result, ServiceHistory{ID: svc.ID, Hour24: buildHour24(relevantIncs, now, nowMs)})
	}

	util.JSONResp(w, map[string]any{"history": result})
}

func HandleCreateService(w http.ResponseWriter, r *http.Request) {
	var svc db.Service
	if err := json.NewDecoder(r.Body).Decode(&svc); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	svc.ID = auth.NewID()
	if svc.IntervalSeconds <= 0 {
		svc.IntervalSeconds = 10
	}
	if svc.CreatedAt == 0 {
		svc.CreatedAt = time.Now().UnixMilli()
	}

	db.ServicesMu.Lock()
	db.Services = append(db.Services, svc)
	db.SaveServices()
	db.ServicesMu.Unlock()

	ping.StartPinger(svc)
	util.JSONResp(w, svc)
}

func HandleUpdateService(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var update db.Service
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	db.ServicesMu.Lock()
	idx := -1
	for i, s := range db.Services {
		if s.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		db.ServicesMu.Unlock()
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	update.ID = id
	if update.IntervalSeconds <= 0 {
		update.IntervalSeconds = 10
	}
	db.Services[idx] = update
	db.SaveServices()
	db.ServicesMu.Unlock()

	ping.StartPinger(update)
	util.JSONResp(w, update)
}

func HandleDeleteService(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	db.ServicesMu.Lock()
	idx := -1
	for i, s := range db.Services {
		if s.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		db.ServicesMu.Unlock()
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	db.Services = append(db.Services[:idx], db.Services[idx+1:]...)
	db.SaveServices()
	db.ServicesMu.Unlock()

	ping.StopPinger(id)

	db.DowntimeMu.Lock()
	kept := db.Incidents[:0]
	for _, inc := range db.Incidents {
		if inc.ServiceID != id {
			kept = append(kept, inc)
		}
	}
	db.Incidents = kept
	db.SaveDowntime()
	db.DowntimeMu.Unlock()

	util.JSONResp(w, map[string]any{"ok": true})
}

func HandleGetPages(w http.ResponseWriter, r *http.Request) {
	db.PagesMu.RLock()
	ps := make([]db.Page, len(db.Pages))
	copy(ps, db.Pages)
	db.PagesMu.RUnlock()
	util.JSONResp(w, map[string]any{"pages": ps})
}

func HandleCreatePage(w http.ResponseWriter, r *http.Request) {
	var p db.Page
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	p.ID = auth.NewID()
	if p.Groups == nil {
		p.Groups = []db.Group{}
	}

	db.PagesMu.Lock()
	db.Pages = append(db.Pages, p)
	db.SavePages()
	db.PagesMu.Unlock()

	util.JSONResp(w, p)
}

func HandleUpdatePage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var update db.Page
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	db.PagesMu.Lock()
	idx := -1
	for i, p := range db.Pages {
		if p.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		db.PagesMu.Unlock()
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	update.ID = id
	if update.Groups == nil {
		update.Groups = []db.Group{}
	}
	db.Pages[idx] = update
	db.SavePages()
	db.PagesMu.Unlock()

	util.JSONResp(w, update)
}

func HandleDeletePage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	db.PagesMu.Lock()
	idx := -1
	for i, p := range db.Pages {
		if p.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		db.PagesMu.Unlock()
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	db.Pages = append(db.Pages[:idx], db.Pages[idx+1:]...)
	db.SavePages()
	db.PagesMu.Unlock()

	util.JSONResp(w, map[string]any{"ok": true})
}

func HandlePageStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	db.PagesMu.RLock()
	var page *db.Page
	for i := range db.Pages {
		if db.Pages[i].ID == id {
			p := db.Pages[i]
			page = &p
			break
		}
	}
	db.PagesMu.RUnlock()

	if page == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	util.JSONResp(w, BuildPageStatus(page))
}

func HandlePageStatusByName(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	db.PagesMu.RLock()
	var page *db.Page
	for i := range db.Pages {
		if db.Pages[i].Name == name {
			p := db.Pages[i]
			page = &p
			break
		}
	}
	db.PagesMu.RUnlock()

	if page == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	util.JSONResp(w, BuildPageStatus(page))
}

func HandlePublicStatus(w http.ResponseWriter, r *http.Request) {
	host := util.StripPort(r.Host)
	page := db.FindPageByHost(host)
	if page == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	util.JSONResp(w, BuildPageStatus(page))
}

type DayHistory struct {
	Date            string `json:"date"`
	Up              bool   `json:"up"`
	DowntimeMs      int64  `json:"downtimeMs"`
	WasDownFullTime bool   `json:"wasDownFullTime"`
}

type HourHistory struct {
	HourStart       int64 `json:"hourStart"`
	Up              bool  `json:"up"`
	DowntimeMs      int64 `json:"downtimeMs"`
	WasDownFullTime bool  `json:"wasDownFullTime"`
}

func summarizeDowntime(total, bucketStart, bucketEnd int64) (int64, bool) {
	elapsed := max64(0, bucketEnd-bucketStart)
	total = min64(total, elapsed)
	return total, elapsed > 0 && total >= elapsed-time.Minute.Milliseconds()
}

type ServiceStatus struct {
	ID                string        `json:"id"`
	Name              string        `json:"name"`
	URL               string        `json:"url"`
	Up                bool          `json:"up"`
	CurrentStatusCode *int          `json:"currentStatusCode"`
	CreatedAt         int64         `json:"createdAt,omitempty"`
	Day30             []DayHistory  `json:"day30"`
	Hour24            []HourHistory `json:"hour24"`
}

type PageStatusResponse struct {
	Page     db.Page         `json:"page"`
	Services []ServiceStatus `json:"services"`
}

func BuildPageStatus(page *db.Page) PageStatusResponse {
	serviceIDs := map[string]struct{}{}
	for _, g := range page.Groups {
		for _, sid := range g.Services {
			serviceIDs[sid] = struct{}{}
		}
	}

	db.ServicesMu.RLock()
	svcMap := map[string]db.Service{}
	for _, s := range db.Services {
		if _, ok := serviceIDs[s.ID]; ok {
			svcMap[s.ID] = s
		}
	}
	db.ServicesMu.RUnlock()

	db.DowntimeMu.RLock()
	incs := make([]db.Incident, len(db.Incidents))
	copy(incs, db.Incidents)
	db.DowntimeMu.RUnlock()

	now := time.Now()
	nowMs := now.UnixMilli()
	cutoff30 := now.AddDate(0, 0, -30).UnixMilli()

	var statuses []ServiceStatus
	for sid := range serviceIDs {
		svc, ok := svcMap[sid]
		if !ok {
			continue
		}

		ss := ServiceStatus{
			ID:        svc.ID,
			Name:      svc.Name,
			URL:       svc.URL,
			Up:        true,
			CreatedAt: svc.CreatedAt,
		}

		var relevantIncs []db.Incident
		for _, inc := range incs {
			if inc.ServiceID != sid {
				continue
			}
			incEnd := nowMs
			if inc.End != nil {
				incEnd = *inc.End
			}
			if incEnd < cutoff30 {
				continue
			}
			if inc.End == nil {
				ss.Up = false
				sc := inc.StatusCode
				ss.CurrentStatusCode = &sc
			}
			relevantIncs = append(relevantIncs, inc)
		}

		ss.Day30 = buildDay30(relevantIncs, now, nowMs)
		ss.Hour24 = buildHour24(relevantIncs, now, nowMs)
		statuses = append(statuses, ss)
	}

	if statuses == nil {
		statuses = []ServiceStatus{}
	}

	return PageStatusResponse{Page: *page, Services: statuses}
}

func buildDay30(incs []db.Incident, now time.Time, nowMs int64) []DayHistory {
	days := make([]DayHistory, 30)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	for i := 0; i < 30; i++ {
		day := today.AddDate(0, 0, -(29 - i))
		dayStart := day.UnixMilli()
		dayEnd := day.AddDate(0, 0, 1).UnixMilli()
		if dayEnd > nowMs {
			dayEnd = nowMs
		}

		dh := DayHistory{
			Date: day.Format("2006-01-02"),
			Up:   true,
		}
		var downtime int64

		for _, inc := range incs {
			incEnd := nowMs
			if inc.End != nil {
				incEnd = *inc.End
			}
			if incEnd < dayStart || inc.Start >= dayEnd {
				continue
			}
			dh.Up = false
			downtime += max64(0, min64(incEnd, dayEnd)-max64(inc.Start, dayStart))
		}

		dh.DowntimeMs, dh.WasDownFullTime = summarizeDowntime(downtime, dayStart, dayEnd)
		days[i] = dh
	}
	return days
}

func buildHour24(incs []db.Incident, now time.Time, nowMs int64) []HourHistory {
	hours := make([]HourHistory, 24)
	hourStart := now.Add(-23 * time.Hour).Truncate(time.Hour)

	for i := 0; i < 24; i++ {
		hs := hourStart.Add(time.Duration(i) * time.Hour)
		hsMs := hs.UnixMilli()
		heMs := hs.Add(time.Hour).UnixMilli()
		if heMs > nowMs {
			heMs = nowMs
		}

		hh := HourHistory{
			HourStart: hsMs,
			Up:        true,
		}
		var downtime int64

		for _, inc := range incs {
			incEnd := nowMs
			if inc.End != nil {
				incEnd = *inc.End
			}
			if incEnd < hsMs || inc.Start >= heMs {
				continue
			}
			hh.Up = false
			downtime += max64(0, min64(incEnd, heMs)-max64(inc.Start, hsMs))
		}

		hh.DowntimeMs, hh.WasDownFullTime = summarizeDowntime(downtime, hsMs, heMs)
		hours[i] = hh
	}
	return hours
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
