IMAGE_NAME := iowoi/jules-master
PLATFORMS ?= linux/amd64,linux/arm64,linux/386,linux/arm/v7

.PHONY: build
build:
	docker buildx build --platform $(PLATFORMS) -t $(IMAGE_NAME):latest . --push

.PHONY: push
push:
	docker push $(IMAGE_NAME):latest
