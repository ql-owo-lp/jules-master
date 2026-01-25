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
	mkdir -p proto/gen/ts
	protoc --go_out=proto --go_opt=paths=source_relative \
		--go-grpc_out=proto --go-grpc_opt=paths=source_relative \
		--proto_path=proto proto/*.proto
	protoc --plugin=./ui/node_modules/.bin/protoc-gen-ts_proto \
	protoc --plugin=./ui/node_modules/.bin/protoc-gen-ts_proto \
		--ts_proto_out=proto \
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

.PHONY: test
test: test-backend test-frontend

.PHONY: test-backend
test-backend:
	cd server && go test ./...

.PHONY: lint
lint:
	cd ui && npm run lint

.PHONY: test-frontend
test-frontend:
	cd ui && npm run test
