image_name := iowoi/jules-master
platforms ?= linux/amd64,linux/arm64,linux/ppc64le

.PHONY: build
build:
	docker build -t $(image_name):latest .

.PHONY: release
release:
	docker buildx build --platform $(platforms) -t $(image_name):latest . --push

.PHONY: proto-gen
proto-gen:
	mkdir -p server/gen proto/gen/ts
	protoc --go_out=server/gen --go_opt=paths=source_relative \
		--go-grpc_out=server/gen --go-grpc_opt=paths=source_relative \
		--proto_path=proto proto/*.proto
	protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto \
		--ts_proto_out=proto/gen/ts \
		--ts_proto_opt=esModuleInterop=true \
		--ts_proto_opt=outputServices=grpc-js \
		--proto_path=proto proto/*.proto

.PHONY: server-init
server-init:
	cd server && go mod init github.com/mcpany/jules || true
	cd server && go get google.golang.org/protobuf
	cd server && go get google.golang.org/grpc
	cd server && go get github.com/mattn/go-sqlite3

.PHONY: server-run
server-run:
	cd server && go run cmd/server/main.go
