package main

type Command string
const (
	CommandGetBoardList Command = "GET_BOARD_LIST"
	CommandGetBoard Command = "GET_BOARD"
	CommandBoard Command = "BOARD"
	CommandBoardList Command = "BOARD_LIST"
	CommandAddNote Command = "ADD_NOTE"
	CommandDeleteNote Command = "DELETE_NOTE"
	CommandEditNote Command = "EDIT_NOTE"
	CommandEditList Command = "EDIT_LIST"
	CommandEditBoard Command = "EDIT_BOARD"
	CommandAddList Command = "ADD_LIST"
	CommandDeleteList Command = "DELETE_LIST"
	CommandAddBoard Command = "ADD_BOARD"
	CommandDeleteBoard Command = "DELETE_BOARD"
)

type Message struct {
	Command Command `json:"command"`
	Data interface{} `json:"data"`
}

type MessageGetBoard struct {
	Id int `json:"id"`
}

type MessageDeleteBoard struct {
	Id int `json:"id"`
}

type MessageAddBoard struct {
	Id int `json:"id,omitempty"`
	Title string `json:"title"`
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
	PreviousNoteId *int `json:"previous_note_id,omitempty"`
}

type MessageEditList struct {
	Id int `json:"id"`
	Title string `json:"title"`
}

type MessageEditBoard struct {
	Id int `json:"id"`
	Title string `json:"title"`
}