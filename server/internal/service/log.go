package service

import (
	"context"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/logger"
)

type LogServer struct {
	pb.UnimplementedLogServiceServer
}

func (s *LogServer) GetLogs(ctx context.Context, req *pb.GetLogsRequest) (*pb.GetLogsResponse, error) {
	logs, err := logger.Get(req.Since)
	if err != nil {
		return nil, err
	}

	// Dereference pointers for response
	var respLogs []*pb.LogEntry
	for _, l := range logs {
		respLogs = append(respLogs, l)
	}

	return &pb.GetLogsResponse{Logs: respLogs}, nil
}
