package main

type Command string
const (
	CommandGetBoards Command = "GET_BOARDS"
	CommandBoards Command = "BOARDS"
	CommandAddNote Command = "ADD_NOTE"
	CommandDeleteNote Command = "DELETE_NOTE"
	CommandEditNote Command = "EDIT_NOTE"
	CommandEditList Command = "EDIT_LIST"
	CommandEditBoard Command = "EDIT_BOARD"
	CommandAddList Command = "ADD_LIST"
	CommandDeleteList Command = "DELETE_LIST"
)

type Message struct {
	Command Command `json:"command"`
	Data interface{} `json:"data"`
}

type MessageAddList struct {
	Id int `json:"id,omitempty"`
	Title string `json:"title"`
	BoardId int `json:"board_id"`
}

type MessageDeleteList struct {
	Id int `json:"id"`
}

type MessageAddNote struct {
	Id int `json:"id,omitempty"`
	Text string `json:"text"`
	ListId int `json:"list_id"`
}

type MessageDeleteNote struct {
	Id int `json:"id"`
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