package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"log"
	"net"
	"os"
	"strings"

	"github.com/mcpany/jules/internal/db"
	gclient "github.com/mcpany/jules/internal/github"
	"github.com/mcpany/jules/internal/service"
	"github.com/mcpany/jules/internal/worker"
	pb "github.com/mcpany/jules/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

func authInterceptor(validToken string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "metadata is not provided")
		}

		values := md["authorization"]
		if len(values) == 0 {
			return nil, status.Error(codes.Unauthenticated, "authorization token is not provided")
		}

		token := values[0]
		// Expect "Bearer <token>"
		parts := strings.SplitN(token, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return nil, status.Error(codes.Unauthenticated, "authorization token format invalid")
		}

		if subtle.ConstantTimeCompare([]byte(parts[1]), []byte(validToken)) != 1 {
			return nil, status.Error(codes.PermissionDenied, "invalid token")
		}

		return handler(ctx, req)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Connect to Database
	dbConn, err := db.Connect()
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	// Instantiate Services
	settingsService := &service.SettingsServer{DB: dbConn}
	profileService := &service.ProfileServer{DB: dbConn}
	logService := &service.LogServer{}
	cronService := &service.CronJobServer{DB: dbConn}
	jobService := &service.JobServer{DB: dbConn}
	promptService := &service.PromptServer{DB: dbConn}
	sessionService := &service.SessionServer{DB: dbConn}

	// Initialize Worker Manager
	workerManager := worker.NewManager()
	workerManager.Register(worker.NewAutoApprovalWorker(dbConn, settingsService, sessionService))
	workerManager.Register(worker.NewBackgroundJobWorker(dbConn, jobService, sessionService, settingsService))
	workerManager.Register(worker.NewAutoDeleteStaleBranchWorker(dbConn, settingsService))
	ghClient := gclient.NewClient(os.Getenv("GITHUB_TOKEN"))
	fetcher := worker.NewRetryableRemoteSessionFetcher()
	workerManager.Register(worker.NewAutoContinueWorker(dbConn, settingsService, sessionService, fetcher, os.Getenv("JULES_API_KEY")))
	workerManager.Register(worker.NewPRMonitorWorker(dbConn, settingsService, sessionService, ghClient, fetcher, os.Getenv("JULES_API_KEY")))
	workerManager.Register(worker.NewAutoRetryWorker(dbConn, settingsService, sessionService))
	workerManager.Register(worker.NewCronWorker(dbConn, cronService, jobService))
	workerManager.Register(worker.NewSessionCacheWorker(dbConn, settingsService, sessionService))
	workerManager.Start()
	defer workerManager.Stop()

	// Create gRPC Server
	opts := []grpc.ServerOption{}
	token := os.Getenv("JULES_INTERNAL_TOKEN")
	if token == "" {
		// Generate a secure random token if none is provided
		bytes := make([]byte, 32)
		if _, err := rand.Read(bytes); err != nil {
			log.Fatalf("failed to generate secure token: %v", err)
		}
		token = hex.EncodeToString(bytes)
		log.Println("WARNING: JULES_INTERNAL_TOKEN not set.")
		log.Printf("Generated secure internal token: %s", token)
		log.Println("Please set JULES_INTERNAL_TOKEN environment variable to persist authentication.")
	} else {
		log.Println("Enforcing internal authentication with JULES_INTERNAL_TOKEN")
	}

	opts = append(opts, grpc.UnaryInterceptor(authInterceptor(token)))
	grpcServer := grpc.NewServer(opts...)

	// Register Services
	pb.RegisterSettingsServiceServer(grpcServer, settingsService)
	pb.RegisterProfileServiceServer(grpcServer, profileService)
	pb.RegisterLogServiceServer(grpcServer, logService)
	pb.RegisterCronJobServiceServer(grpcServer, cronService)
	pb.RegisterJobServiceServer(grpcServer, jobService)
	pb.RegisterPromptServiceServer(grpcServer, promptService)
	pb.RegisterSessionServiceServer(grpcServer, sessionService)
	pb.RegisterChatServiceServer(grpcServer, &service.ChatServer{DB: dbConn})

	// Enable reflection for grpcurl
	reflection.Register(grpcServer)

	log.Printf("server listening at %v", listener.Addr())
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
