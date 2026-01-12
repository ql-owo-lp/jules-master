package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jules-org/jules/backend/pkg/db"
	"github.com/jules-org/jules/backend/pkg/proto/jules/julesconnect"
	"github.com/jules-org/jules/backend/pkg/service"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	// Configure logging
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	// Initialize DB
	if err := db.InitDB(); err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer db.Close()

	// Create Services
	jobService := service.NewJobService()
	sessionService := service.NewSessionService()
	settingsService := service.NewSettingsService()

	// Register handlers
	mux := http.NewServeMux()
	path, handler := julesconnect.NewJobServiceHandler(jobService)
	mux.Handle(path, handler)
	path, handler = julesconnect.NewSessionServiceHandler(sessionService)
	mux.Handle(path, handler)
	path, handler = julesconnect.NewSettingsServiceHandler(settingsService)
	mux.Handle(path, handler)

	// Server setup
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: h2c.NewHandler(mux, &http2.Server{}),
	}

	// Graceful shutdown
	go func() {
		log.Info().Msgf("Starting server on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	log.Info().Msg("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Server shutdown with error")
	}
	log.Info().Msg("Server exited")
}
