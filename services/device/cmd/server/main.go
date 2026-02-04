package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/etheon/rubic/services/device/internal/config"
	"github.com/etheon/rubic/services/device/internal/handlers"
	"github.com/etheon/rubic/services/device/internal/mqtt"
	"github.com/etheon/rubic/services/device/internal/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Configure logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("ENVIRONMENT") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	// Load config
	cfg := config.Load()

	log.Info().
		Str("environment", cfg.Environment).
		Int("port", cfg.Port).
		Msg("Starting device service")

	// Initialize MQTT client
	mqttClient, err := mqtt.NewClient(cfg)
	if err != nil {
		log.Warn().Err(err).Msg("MQTT client initialization failed - continuing without MQTT")
	}

	// Initialize WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Initialize handlers
	deviceHandler := handlers.NewDeviceHandler(cfg, mqttClient, wsHub)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}))

	// Request logging
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("request_id", middleware.GetReqID(r.Context())).
				Str("user_id", r.Header.Get("x-user-id")).
				Msg("Request received")
			next.ServeHTTP(w, r)
		})
	})

	// Health routes
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"device"}`))
	})

	// API routes
	r.Route("/v1", func(r chi.Router) {
		// Device management
		r.Post("/devices", deviceHandler.RegisterDevice)
		r.Get("/devices", deviceHandler.ListDevices)
		r.Get("/devices/{id}", deviceHandler.GetDevice)
		r.Delete("/devices/{id}", deviceHandler.UnregisterDevice)

		// Device commands
		r.Post("/devices/{id}/command", deviceHandler.ExecuteCommand)
		r.Get("/devices/{id}/stream", deviceHandler.StreamDevice)

		// Tool execution (called by agent service)
		r.Post("/tools/execute", deviceHandler.ExecuteTool)

		// WebSocket endpoint
		r.Get("/ws", deviceHandler.HandleWebSocket)
	})

	// Start server
	server := &http.Server{
		Addr:    ":" + cfg.PortStr(),
		Handler: r,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	log.Info().Int("port", cfg.Port).Msg("Device service started")

	<-done
	log.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Server shutdown failed")
	}

	// Cleanup
	if mqttClient != nil {
		mqttClient.Disconnect()
	}
	wsHub.Shutdown()

	log.Info().Msg("Server stopped")
}
