package main

import (
	"context"
	"fmt"
	"log"
	"time"

	pb "github.com/mcpany/jules/gen"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

func main() {
	conn, err := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

	c := pb.NewSettingsServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	r, err := c.GetSettings(ctx, &pb.GetSettingsRequest{ProfileId: "default"})
	if err != nil {
		log.Fatalf("could not get settings: %v", err)
	}
	fmt.Printf("GetSettings Result: %+v\n", r)
    
    // Test CronJob list
    cronClient := pb.NewCronJobServiceClient(conn)
    cronList, err := cronClient.ListCronJobs(ctx, &emptypb.Empty{}) 
    if err != nil {
        log.Fatalf("could not list cron jobs: %v", err)
    }
    fmt.Printf("ListCronJobs Result: %+v\n", cronList)
}
