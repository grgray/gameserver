# GameServer

A game server which provides multi-player Dot Pad game play.

This repository holds the server and the individual games it serves. Each game
lives in its own top-level directory as a self-contained Go module with its own
README, so it can be built, tested and deployed independently.

## Components

| Directory              | Description                                        |
| ---------------------- | -------------------------------------------------- |
| [`tictacto/`](tictacto/README.md) | Two-player tic-tac-toe playable from the command line |

`tictacto` is currently the only component in the repository.

## Getting started

Each component is built and run from its own directory. To play tic-tac-toe:

```sh
cd tictacto
go run .
```

See that component's [README](tictacto/README.md) for its build, test and usage
details.

## Repository layout

```
gameserver/
├── README.md      this file — what the repo is and what it contains
├── .gitignore
└── tictacto/      tic-tac-toe game (Go module)
```

A new game is added as a sibling directory of `tictacto`, following the same
shape: its own `go.mod`, its own tests, and a README covering how to build,
run and test it.

## Build output

Components build to a `bin/` directory inside their own directory, which is
git-ignored:

```sh
cd tictacto
go build -o bin/ .
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
