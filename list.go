package main

type List struct {
	ID      uint64 `json:"id,string"`
	BoardID uint64 `json:"board_id,string"`
	Title   string `json:"title"`
	Order   uint   `json:"order"`
	Notes   []Note `json:"notes"`
}
