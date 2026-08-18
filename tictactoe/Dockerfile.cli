# ---- Build stage ----
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy go.mod (and go.sum if present) first for better layer caching. The
# glob keeps this working even though the module has no dependencies and
# therefore no go.sum yet.
COPY go.mod go.sum* ./
RUN go mod download

# Copy the rest of the source
COPY . .

# Build a static binary for the interactive CLI front end only.
RUN CGO_ENABLED=0 GOOS=linux go build -o app ./cmd/cli

# ---- Final stage ----
FROM alpine:3.20

WORKDIR /app

COPY --from=builder /app/app .

# Interactive: run with `docker run -it` to attach a terminal.
ENTRYPOINT ["./app"]
