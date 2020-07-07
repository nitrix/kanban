package main

type Note struct {
	ID int `json:"id"`
	Minimized bool `json:"min"`
	Raw bool `json:"raw"`
	Text string `json:"text"`
}
