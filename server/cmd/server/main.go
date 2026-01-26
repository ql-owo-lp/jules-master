package main

import (
	"log"
	"net"
	"os"

	pb "github.com/mcpany/jules/proto"
	"github.com/mcpany/jules/internal/db"
	gclient "github.com/mcpany/jules/internal/github"
	"github.com/mcpany/jules/internal/service"
	"github.com/mcpany/jules/internal/worker"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

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
	workerManager.Register(worker.NewAutoContinueWorker(dbConn, settingsService, sessionService))
	ghClient := gclient.NewClient(os.Getenv("GITHUB_TOKEN"))
	fetcher := worker.NewRetryableRemoteSessionFetcher()
	workerManager.Register(worker.NewPRMonitorWorker(dbConn, settingsService, sessionService, ghClient, fetcher, os.Getenv("JULES_API_KEY")))
	workerManager.Register(worker.NewAutoRetryWorker(dbConn, settingsService, sessionService))
	workerManager.Register(worker.NewCronWorker(dbConn, cronService, jobService))
	workerManager.Register(worker.NewSessionCacheWorker(dbConn, settingsService, sessionService))
	workerManager.Start()
	defer workerManager.Stop()

	// Create gRPC Server
	grpcServer := grpc.NewServer()

	// Register Services
	pb.RegisterSettingsServiceServer(grpcServer, settingsService)
	pb.RegisterProfileServiceServer(grpcServer, profileService)
	pb.RegisterLogServiceServer(grpcServer, logService)
	pb.RegisterCronJobServiceServer(grpcServer, cronService)
	pb.RegisterJobServiceServer(grpcServer, jobService)
	pb.RegisterPromptServiceServer(grpcServer, promptService)
	pb.RegisterSessionServiceServer(grpcServer, sessionService)

	// Enable reflection for grpcurl
	reflection.Register(grpcServer)

	log.Printf("server listening at %v", listener.Addr())
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
