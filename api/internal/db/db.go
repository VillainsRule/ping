package db

import (
	"encoding/json"
	"os"
	"sync"
)

type Service struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	URL             string `json:"url"`
	IntervalSeconds int    `json:"intervalSeconds"`
	Tag             string `json:"tag"`
	CreatedAt       int64  `json:"createdAt,omitempty"`
}

type Incident struct {
	ID         string `json:"id"`
	ServiceID  string `json:"serviceId"`
	Start      int64  `json:"start"`
	End        *int64 `json:"end"`
	StatusCode int    `json:"statusCode"`
}

type Group struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Order    int      `json:"order"`
	Services []string `json:"services"`
}

type Page struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Hostname    string  `json:"hostname"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	FooterText  string  `json:"footerText"`
	IconURL     string  `json:"iconUrl"`
	Groups      []Group `json:"groups"`
}

type servicesFile struct {
	Services []Service `json:"services"`
}

type downtimeFile struct {
	Incidents []Incident `json:"incidents"`
}

type pagesFile struct {
	Pages []Page `json:"pages"`
}

var (
	ServicesMu sync.RWMutex
	Services   []Service

	DowntimeMu sync.RWMutex
	Incidents  []Incident

	PagesMu sync.RWMutex
	Pages   []Page
)

func LoadDB() error {
	{
		data, err := os.ReadFile("data/services.json")
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if len(data) > 0 {
			var f servicesFile
			if err := json.Unmarshal(data, &f); err != nil {
				return err
			}
			Services = f.Services
		}
	}
	{
		data, err := os.ReadFile("data/downtime.json")
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if len(data) > 0 {
			var f downtimeFile
			if err := json.Unmarshal(data, &f); err != nil {
				return err
			}
			Incidents = f.Incidents
		}
	}
	{
		data, err := os.ReadFile("data/pages.json")
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if len(data) > 0 {
			var f pagesFile
			if err := json.Unmarshal(data, &f); err != nil {
				return err
			}
			Pages = f.Pages
		}
	}
	return nil
}

func SaveServices() {
	data, _ := json.Marshal(servicesFile{Services: Services})
	_ = os.WriteFile("data/services.json", data, 0644)
}

func SaveDowntime() {
	data, _ := json.Marshal(downtimeFile{Incidents: Incidents})
	_ = os.WriteFile("data/downtime.json", data, 0644)
}

func SavePages() {
	data, _ := json.Marshal(pagesFile{Pages: Pages})
	_ = os.WriteFile("data/pages.json", data, 0644)
}

func FindPageByHost(host string) *Page {
	PagesMu.RLock()
	defer PagesMu.RUnlock()
	for i := range Pages {
		if Pages[i].Hostname == host {
			return &Pages[i]
		}
	}
	return nil
}

func IsStatusPageHost(host string) bool {
	return FindPageByHost(host) != nil
}
