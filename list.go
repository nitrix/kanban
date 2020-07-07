package main

type List struct {
	ID int `json:"id"`
	Title string `json:"title"`
	Notes []Note `json:"notes"`
}