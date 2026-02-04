package websocket

import (
	"encoding/json"
	"sync"

	"github.com/rs/zerolog/log"
)

type Hub struct {
	// Registered clients by device ID
	clients   map[string]*Client
	clientsMu sync.RWMutex

	// Device output subscribers
	subscribers   map[string][]chan []byte
	subscribersMu sync.RWMutex

	// Channels
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	shutdown   chan struct{}
}

func NewHub() *Hub {
	return &Hub{
		clients:     make(map[string]*Client),
		subscribers: make(map[string][]chan []byte),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		broadcast:   make(chan []byte),
		shutdown:    make(chan struct{}),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clientsMu.Lock()
			h.clients[client.DeviceID] = client
			h.clientsMu.Unlock()
			log.Info().Str("device_id", client.DeviceID).Msg("Client registered")

		case client := <-h.unregister:
			h.clientsMu.Lock()
			if _, ok := h.clients[client.DeviceID]; ok {
				delete(h.clients, client.DeviceID)
				close(client.Send)
			}
			h.clientsMu.Unlock()
			log.Info().Str("device_id", client.DeviceID).Msg("Client unregistered")

		case message := <-h.broadcast:
			h.clientsMu.RLock()
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.DeviceID)
				}
			}
			h.clientsMu.RUnlock()

		case <-h.shutdown:
			h.clientsMu.Lock()
			for _, client := range h.clients {
				close(client.Send)
			}
			h.clients = make(map[string]*Client)
			h.clientsMu.Unlock()
			return
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) SendToDevice(deviceID string, message any) bool {
	h.clientsMu.RLock()
	client, ok := h.clients[deviceID]
	h.clientsMu.RUnlock()

	if !ok {
		return false
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal message")
		return false
	}

	select {
	case client.Send <- data:
		return true
	default:
		return false
	}
}

func (h *Hub) SubscribeToDevice(deviceID string, ch chan []byte) {
	h.subscribersMu.Lock()
	h.subscribers[deviceID] = append(h.subscribers[deviceID], ch)
	h.subscribersMu.Unlock()
}

func (h *Hub) UnsubscribeFromDevice(deviceID string, ch chan []byte) {
	h.subscribersMu.Lock()
	defer h.subscribersMu.Unlock()

	subs := h.subscribers[deviceID]
	for i, sub := range subs {
		if sub == ch {
			h.subscribers[deviceID] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
}

func (h *Hub) NotifySubscribers(deviceID string, data []byte) {
	h.subscribersMu.RLock()
	subs := h.subscribers[deviceID]
	h.subscribersMu.RUnlock()

	for _, ch := range subs {
		select {
		case ch <- data:
		default:
			// Subscriber channel full, skip
		}
	}
}

func (h *Hub) Shutdown() {
	close(h.shutdown)
}
