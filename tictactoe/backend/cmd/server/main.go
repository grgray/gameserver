package main

import (
	"flag"
	"fmt"
	"log"
	"os"
)

func main() {
	addr := flag.String("http", ":8080", "address to serve the REST API on")
	static := flag.String("static", "", "directory of the built frontend to serve at / (empty = API only)")
	flag.Parse()

	log.Printf("tic-tac-toe REST API listening on %s", *addr)

	var err error
	if *static == "" {
		err = ListenAndServe(*addr)
	} else {
		err = ListenAndServeStatic(*addr, *static)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
