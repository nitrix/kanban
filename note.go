package main

type Note struct {
	ID        uint64 `json:"id,string"`
	ListID    uint64 `json:"list_id,string"`
	Minimized bool   `json:"min"`
	Raw       bool   `json:"raw"`
	Text      string `json:"text"`
	Order     uint
}
