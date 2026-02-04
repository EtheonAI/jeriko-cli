FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY services/device/go.mod services/device/go.sum ./

# Download dependencies
RUN go mod download

# Copy source
COPY services/device/ .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o device-service ./cmd/server

# Production image
FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/device-service .

ENV ENVIRONMENT=production

EXPOSE 8080

CMD ["./device-service"]
