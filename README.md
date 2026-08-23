# GameServer

A game server which provides multi-player Dot Pad game play.

This repository holds the server and the individual games it serves. Each game
lives in its own top-level directory with a `backend/` Go module and, where it
has a web interface, a `frontend/` JavaScript app, plus its own README, so it
can be built, tested and deployed independently.

## Components

| Directory              | Description                                        |
| ---------------------- | -------------------------------------------------- |
| [`tictactoe/`](tictactoe/README.md) | Two-player tic-tac-toe: interactive CLI, REST API, and an accessible React web app, each its own deployable service |

`tictactoe` is currently the only component in the repository.

## Getting started

Each component is built and run from its own directory. To play tic-tac-toe:

```sh
cd tictactoe/backend
go run ./cmd/cli           # interactive
go run ./cmd/server        # REST API on :8080

cd ../frontend
npm install
npm run dev                # web app on :5173 (proxies the API)
```

See that component's [README](tictactoe/README.md) for its build, test and usage
details.

## Repository layout

```
gameserver/
├── README.md      this file — what the repo is and what it contains
├── .gitignore
└── tictactoe/     tic-tac-toe game
    ├── backend/           Go module: shared engine, CLI, REST API
    │   ├── internal/game/   shared game engine
    │   ├── cmd/cli/         interactive front end
    │   └── cmd/server/      REST API front end
    ├── frontend/          React (TypeScript) web app
    ├── Dockerfile.cli
    └── Dockerfile.server
```

A new game is added as a sibling directory of `tictactoe`, following the same
shape: its own `backend/go.mod`, its own tests, and a README covering how to
build, run and test it. Where a game has multiple front ends, following
`tictactoe`'s pattern — a shared `internal/` engine package plus one `cmd/`
directory per back-end front end, and a `frontend/` app where a web UI is
wanted — keeps each one independently buildable and deployable.

## Build output

Components build to a `bin/` directory inside their own directory, which is
git-ignored:

```sh
cd tictactoe/backend
go build -o bin/ ./cmd/cli ./cmd/server
```

Use the trailing slash on `-o`. Given a directory, Go names the binary after
the package and adds the platform's executable extension; given an explicit
filename it writes that name verbatim, which produces an extensionless binary
on Windows and a binary that `.gitignore`'s `*.exe` rule will not catch on
Linux CI runners.

## Conventions

Go code in this repository is expected to be formatted with `gofmt`, pass
`go vet`, and ship with tests. Before committing, from within a component
directory:

```sh
gofmt -l .        # prints nothing when formatting is clean
go vet ./...
go test ./...
```

Frontend code ships with tests and a production build; from a `frontend/`
directory:

```sh
npm test
npm run lint
npm run build
```
