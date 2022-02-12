package main

type Board struct {
	ID    uint64 `json:"id,string"`
	Title string `json:"title"`
	Lists []List `json:"lists,omitempty"`
}
