package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/etheon/rubic/services/device/internal/config"
	"github.com/etheon/rubic/services/device/internal/models"
	"github.com/etheon/rubic/services/device/internal/mqtt"
	"github.com/etheon/rubic/services/device/internal/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

type DeviceHandler struct {
	cfg        *config.Config
	mqttClient *mqtt.Client
	wsHub      *websocket.Hub

	// In-memory device store (use database in production)
	devices   map[string]*models.Device
	devicesMu sync.RWMutex
}

func NewDeviceHandler(cfg *config.Config, mqttClient *mqtt.Client, wsHub *websocket.Hub) *DeviceHandler {
	return &DeviceHandler{
		cfg:        cfg,
		mqttClient: mqttClient,
		wsHub:      wsHub,
		devices:    make(map[string]*models.Device),
	}
}

func (h *DeviceHandler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("x-user-id")
	if userID == "" {
		h.errorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "User ID required")
		return
	}

	var req models.RegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	device := &models.Device{
		ID:           uuid.New().String(),
		UserID:       userID,
		Name:         req.Name,
		Type:         req.Type,
		Status:       models.DeviceStatusOnline,
		Capabilities: req.Capabilities,
		Platform:     req.Platform,
		Version:      req.Version,
		IPAddress:    r.RemoteAddr,
		LastSeenAt:   time.Now(),
		Metadata:     req.Metadata,
		CreatedAt:    time.Now(),
	}

	h.devicesMu.Lock()
	h.devices[device.ID] = device
	h.devicesMu.Unlock()

	log.Info().
		Str("device_id", device.ID).
		Str("user_id", userID).
		Str("type", string(device.Type)).
		Msg("Device registered")

	h.successResponse(w, http.StatusCreated, device)
}

func (h *DeviceHandler) ListDevices(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("x-user-id")
	if userID == "" {
		h.errorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "User ID required")
		return
	}

	h.devicesMu.RLock()
	devices := make([]*models.Device, 0)
	for _, device := range h.devices {
		if device.UserID == userID {
			devices = append(devices, device)
		}
	}
	h.devicesMu.RUnlock()

	h.successResponse(w, http.StatusOK, devices)
}

func (h *DeviceHandler) GetDevice(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("x-user-id")
	deviceID := chi.URLParam(r, "id")

	h.devicesMu.RLock()
	device, exists := h.devices[deviceID]
	h.devicesMu.RUnlock()

	if !exists || device.UserID != userID {
		h.errorResponse(w, http.StatusNotFound, "NOT_FOUND", "Device not found")
		return
	}

	h.successResponse(w, http.StatusOK, device)
}

func (h *DeviceHandler) UnregisterDevice(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("x-user-id")
	deviceID := chi.URLParam(r, "id")

	h.devicesMu.Lock()
	device, exists := h.devices[deviceID]
	if exists && device.UserID == userID {
		delete(h.devices, deviceID)
	}
	h.devicesMu.Unlock()

	if !exists || device.UserID != userID {
		h.errorResponse(w, http.StatusNotFound, "NOT_FOUND", "Device not found")
		return
	}

	log.Info().
		Str("device_id", deviceID).
		Str("user_id", userID).
		Msg("Device unregistered")

	h.successResponse(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *DeviceHandler) ExecuteCommand(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("x-user-id")
	deviceID := chi.URLParam(r, "id")

	h.devicesMu.RLock()
	device, exists := h.devices[deviceID]
	h.devicesMu.RUnlock()

	if !exists || device.UserID != userID {
		h.errorResponse(w, http.StatusNotFound, "NOT_FOUND", "Device not found")
		return
	}

	var req models.ExecuteCommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	// Safety check
	if req.IsDangerous() {
		h.errorResponse(w, http.StatusForbidden, "DANGEROUS_COMMAND", "This command is not allowed")
		return
	}

	// Check if approval is required
	if req.RequiresApproval() {
		approvalID := uuid.New().String()
		log.Info().
			Str("device_id", deviceID).
			Str("command", req.Command).
			Str("approval_id", approvalID).
			Msg("Command requires approval")

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]any{
			"status":      "approval_required",
			"approval_id": approvalID,
			"message":     "This command requires user approval",
		})
		return
	}

	// Send command to device via WebSocket or MQTT
	command := &models.DeviceCommand{
		ID:        uuid.New().String(),
		DeviceID:  deviceID,
		UserID:    userID,
		Type:      req.Type,
		Command:   req.Command,
		Arguments: req.Arguments,
		Status:    "executing",
		CreatedAt: time.Now(),
	}

	// Try WebSocket first
	if h.wsHub.SendToDevice(deviceID, command) {
		log.Info().
			Str("device_id", deviceID).
			Str("command_id", command.ID).
			Msg("Command sent via WebSocket")
	} else if h.mqttClient != nil {
		// Fall back to MQTT
		h.mqttClient.PublishCommand(deviceID, command)
		log.Info().
			Str("device_id", deviceID).
			Str("command_id", command.ID).
			Msg("Command sent via MQTT")
	} else {
		h.errorResponse(w, http.StatusServiceUnavailable, "DEVICE_OFFLINE", "Device is not connected")
		return
	}

	h.successResponse(w, http.StatusOK, command)
}

func (h *DeviceHandler) StreamDevice(w http.ResponseWriter, r *http.Request) {
	// SSE endpoint for device output streaming
	userID := r.Header.Get("x-user-id")
	deviceID := chi.URLParam(r, "id")

	h.devicesMu.RLock()
	device, exists := h.devices[deviceID]
	h.devicesMu.RUnlock()

	if !exists || device.UserID != userID {
		h.errorResponse(w, http.StatusNotFound, "NOT_FOUND", "Device not found")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		h.errorResponse(w, http.StatusInternalServerError, "STREAMING_ERROR", "Streaming not supported")
		return
	}

	// Create channel for device output
	output := make(chan []byte, 100)
	h.wsHub.SubscribeToDevice(deviceID, output)
	defer h.wsHub.UnsubscribeFromDevice(deviceID, output)

	// Send heartbeat and device output
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case data := <-output:
			w.Write([]byte("data: "))
			w.Write(data)
			w.Write([]byte("\n\n"))
			flusher.Flush()
		case <-ticker.C:
			w.Write([]byte(": heartbeat\n\n"))
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (h *DeviceHandler) ExecuteTool(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("x-user-id")

	var req models.ToolExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	h.devicesMu.RLock()
	device, exists := h.devices[req.DeviceID]
	h.devicesMu.RUnlock()

	if !exists || device.UserID != userID {
		h.errorResponse(w, http.StatusNotFound, "NOT_FOUND", "Device not found")
		return
	}

	// Map tool to command
	var cmdReq models.ExecuteCommandRequest
	switch req.ToolName {
	case "terminal_command":
		cmdReq = models.ExecuteCommandRequest{
			Type:    "terminal",
			Command: req.Arguments["command"].(string),
		}
	case "file_read":
		cmdReq = models.ExecuteCommandRequest{
			Type:      "file_read",
			Command:   "cat",
			Arguments: map[string]any{"path": req.Arguments["path"]},
		}
	case "file_write":
		cmdReq = models.ExecuteCommandRequest{
			Type:    "file_write",
			Command: "write",
			Arguments: map[string]any{
				"path":    req.Arguments["path"],
				"content": req.Arguments["content"],
			},
		}
	default:
		h.errorResponse(w, http.StatusBadRequest, "UNKNOWN_TOOL", "Unknown tool: "+req.ToolName)
		return
	}

	// Check safety
	if cmdReq.RequiresApproval() {
		approvalID := uuid.New().String()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]any{
			"approval_id": approvalID,
		})
		return
	}

	// Execute command
	command := &models.DeviceCommand{
		ID:        uuid.New().String(),
		DeviceID:  req.DeviceID,
		UserID:    userID,
		Type:      cmdReq.Type,
		Command:   cmdReq.Command,
		Arguments: cmdReq.Arguments,
		Status:    "executing",
		CreatedAt: time.Now(),
	}

	if !h.wsHub.SendToDevice(req.DeviceID, command) {
		h.errorResponse(w, http.StatusServiceUnavailable, "DEVICE_OFFLINE", "Device is not connected")
		return
	}

	h.successResponse(w, http.StatusOK, map[string]any{
		"command_id": command.ID,
		"status":     "executing",
	})
}

var upgrader = ws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func (h *DeviceHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}

	// Get device ID from query params
	deviceID := r.URL.Query().Get("device_id")
	userID := r.Header.Get("x-user-id")

	if deviceID == "" {
		conn.WriteMessage(ws.TextMessage, []byte(`{"error":"device_id required"}`))
		conn.Close()
		return
	}

	client := websocket.NewClient(h.wsHub, conn, deviceID, userID)
	h.wsHub.Register(client)

	log.Info().
		Str("device_id", deviceID).
		Str("user_id", userID).
		Msg("WebSocket client connected")

	go client.WritePump()
	go client.ReadPump()
}

// Helper methods

func (h *DeviceHandler) successResponse(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"data": data,
		"meta": map[string]any{
			"request_id": middleware.GetReqID(nil),
			"timestamp":  time.Now().Format(time.RFC3339),
		},
		"error": nil,
	})
}

func (h *DeviceHandler) errorResponse(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"data": nil,
		"meta": map[string]any{
			"request_id": middleware.GetReqID(nil),
			"timestamp":  time.Now().Format(time.RFC3339),
		},
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
