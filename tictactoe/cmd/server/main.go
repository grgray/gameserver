package main

import (
	"flag"
	"fmt"
	"log"
	"os"
)

func main() {
	addr := flag.String("http", ":8080", "address to serve the REST API on")
	flag.Parse()

	log.Printf("tic-tac-toe REST API listening on %s", *addr)
	if err := ListenAndServe(*addr); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
