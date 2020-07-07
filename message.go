package main

type Command string
const (
	CommandGetBoards Command = "GET_BOARDS"
	CommandBoards Command = "BOARDS"
	CommandEditNote Command = "EDIT_NOTE"
	CommandEditList Command = "EDIT_LIST"
	CommandEditBoard Command = "EDIT_BOARD"
)

type Message struct {
	Command Command `json:"command"`
	Data interface{} `json:"data"`
}

type MessageEditNote struct {
	Id int `json:"id"`
	ListId int `json:"list_id,omitempty"`
	Text string `json:"text,omitempty"`
	Raw *bool `json:"raw,omitempty"`
	Minimized *bool `json:"minimized,omitempty"`
}

type MessageEditList struct {
	Id int `json:"id"`
	Title string `json:"title"`
}

type MessageEditBoard struct {
	Id int `json:"id"`
	Title string `json:"title"`
}