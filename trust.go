package main

import (
	"os"
	"strings"
)

var trusted = make(map[string]struct{})

func isTrusted(token string) bool {
	_, ok := trusted[token]
	return ok
}

func trust(token string) {
	if truthy(os.Getenv("FEATURE_STAY_LOGGED")) {
		trusted[token] = struct{}{}
	}
}

func truthy(s string) bool {
	s = strings.ToLower(s)
	return s == "true" || s == "1" || s == "on" || s == "yes"
}