IMAGE_NAME := iowoi/jules-master
PLATFORMS ?= linux/amd64,linux/arm64,linux/ppc64le,linux/s390x

.PHONY: build
build:
	docker build -t $(IMAGE_NAME):latest .

.PHONY: release
release:
	docker buildx build --platform $(PLATFORMS) -t $(IMAGE_NAME):latest . --push
